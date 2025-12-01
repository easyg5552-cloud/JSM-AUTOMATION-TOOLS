import { Scene, ImageAspect, ExportFormat } from '../types';

interface ExportOptions {
  aspectRatio: ImageAspect;
  format: ExportFormat;
  onProgress: (percent: number, status: string) => void;
}

export const exportVideo = async (scenes: Scene[], options: ExportOptions): Promise<Blob> => {
  const { aspectRatio, format, onProgress } = options;

  // 0. Handle Audio Only Export
  if (format === ExportFormat.AudioOnly) {
     return exportAudioOnly(scenes, onProgress);
  }

  // 1. Determine Resolution based on Aspect Ratio and Format
  let baseWidth = 1920;
  let baseHeight = 1080;

  switch (format) {
    case ExportFormat.Video720p:
        baseWidth = 1280; baseHeight = 720; break;
    case ExportFormat.Video1080p:
        baseWidth = 1920; baseHeight = 1080; break;
    case ExportFormat.Video2K:
        baseWidth = 2560; baseHeight = 1440; break;
    case ExportFormat.Video4K:
        baseWidth = 3840; baseHeight = 2160; break;
    default:
        baseWidth = 1920; baseHeight = 1080;
  }

  // Adjust for Aspect Ratio
  let width = baseWidth;
  let height = baseHeight;

  if (aspectRatio === ImageAspect.NineSixteen) {
    width = baseHeight;
    height = baseWidth;
  } else if (aspectRatio === ImageAspect.OneOne) {
    width = baseHeight;
    height = baseHeight; 
  }

  // 2. Setup Canvas & Audio Context
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  
  if (!ctx) throw new Error("Could not create canvas context");

  // Initialize black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  
  // 3. Pre-load Assets
  onProgress(0, "Loading assets...");
  
  const loadedScenes = await Promise.all(scenes.map(async (scene) => {
    // Load Image
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image for scene ${scene.sequence}`));
      if (scene.imageUrl) img.src = scene.imageUrl;
      else reject(new Error("No image URL"));
    });

    // Load Audio
    let audioBuffer: AudioBuffer | null = null;
    if (scene.audioUrl) {
      try {
        const response = await fetch(scene.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn("Failed to load audio for scene", scene.id);
      }
    }

    // Determine Final Duration
    // Strictly respect manualDuration if set, otherwise max of audio vs estimated
    const finalDuration = Math.max(audioBuffer?.duration || 0, scene.manualDuration || scene.estimatedDuration || 5);

    return { ...scene, img, audioBuffer, finalDuration };
  }));

  // Calculate Timeline
  let totalDuration = 0;
  const timelineScenes = loadedScenes.map(s => {
    const start = totalDuration;
    totalDuration += s.finalDuration;
    return { ...s, startTime: start, endTime: totalDuration };
  });

  // 4. Setup MediaRecorder
  const canvasStream = canvas.captureStream(30); // Request 30 FPS stream
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  const mimeTypes = [
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm'
  ];
  
  let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
  if (!selectedMimeType) {
      if (MediaRecorder.isTypeSupported('video/mp4')) selectedMimeType = 'video/mp4';
      else if (MediaRecorder.isTypeSupported('video/webm')) selectedMimeType = 'video/webm';
  }

  const bitrates = {
      [ExportFormat.Video720p]: 2500000,
      [ExportFormat.Video1080p]: 5000000,
      [ExportFormat.Video2K]: 8000000,
      [ExportFormat.Video4K]: 15000000,
  };

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMimeType,
    videoBitsPerSecond: bitrates[format as keyof typeof bitrates] || 5000000
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMimeType || 'video/mp4' });
      
      // Cleanup
      combinedStream.getTracks().forEach(track => track.stop());
      canvasStream.getTracks().forEach(track => track.stop());
      audioCtx.close();
      
      if (blob.size === 0) reject(new Error("Recording failed: Output file is empty."));
      else resolve(blob);
    };

    recorder.onerror = (e) => reject(e);

    // 5. Pre-schedule ALL Audio
    // We schedule audio on the AudioContext timeline to ensure perfect sync and no gaps.
    // The visual loop will just follow the clock.
    await audioCtx.resume(); // Ensure context is running
    const audioStartTime = audioCtx.currentTime + 0.1; // Start 100ms in future to ensure clean start

    timelineScenes.forEach(scene => {
      if (scene.audioBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = scene.audioBuffer;
        source.connect(dest);
        source.start(audioStartTime + scene.startTime);
      }
    });

    recorder.start();
    
    // 6. Visual Rendering Loop
    // We use audioCtx.currentTime as the MASTER CLOCK to ensure A/V sync.
    // Performance.now() can drift from AudioContext time.
    
    const renderLoop = async () => {
       while (true) {
         // Master Clock: Audio Time
         const currentAudioTime = audioCtx.currentTime;
         
         // Calculate elapsed time since start (subtract the 0.1s offset)
         // We clamp to 0 to avoid negative time during the 0.1s preload
         const elapsedSecs = Math.max(0, currentAudioTime - audioStartTime);

         if (elapsedSecs >= totalDuration) {
             break;
         }

         // Find active scene
         const currentScene = timelineScenes.find(s => elapsedSecs >= s.startTime && elapsedSecs < s.endTime);
         
         if (currentScene) {
             const sceneProgress = (elapsedSecs - currentScene.startTime) / currentScene.finalDuration;
             
             // Ken Burns Effect
             const scale = 1 + (0.05 * sceneProgress); // Subtle zoom 5%
             
             const imgAspect = currentScene.img.width / currentScene.img.height;
             const canvasAspect = width / height;
             
             let drawWidth, drawHeight, offsetX, offsetY;

             if (imgAspect > canvasAspect) {
                 drawHeight = height * scale;
                 drawWidth = height * imgAspect * scale;
                 offsetY = (height - drawHeight) / 2;
                 offsetX = (width - drawWidth) / 2;
             } else {
                 drawWidth = width * scale;
                 drawHeight = (width / imgAspect) * scale;
                 offsetX = (width - drawWidth) / 2;
                 offsetY = (height - drawHeight) / 2;
             }

             ctx.clearRect(0, 0, width, height);
             ctx.drawImage(currentScene.img, offsetX, offsetY, drawWidth, drawHeight);
         } else {
             // Safe fallback
             ctx.fillStyle = 'black';
             ctx.fillRect(0, 0, width, height);
         }

         // Update Progress
         const progressPercent = Math.min(99, Math.round((elapsedSecs / totalDuration) * 100));
         onProgress(progressPercent, `Rendering... ${(totalDuration - elapsedSecs).toFixed(1)}s left`);

         // Wait for next frame (approx 30fps)
         await new Promise(r => setTimeout(r, 33));
       }

       recorder.stop();
    };

    renderLoop();
  });
};

const exportAudioOnly = async (scenes: Scene[], onProgress: (percent: number, status: string) => void): Promise<Blob> => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Load Audio Buffers
    onProgress(10, "Loading audio tracks...");
    const loadedAudios = await Promise.all(scenes.map(async (scene) => {
        if (scene.audioUrl) {
            try {
                const response = await fetch(scene.audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                return await audioCtx.decodeAudioData(arrayBuffer);
            } catch (e) { return null; }
        }
        return null;
    }));

    // Setup Recorder
    const mimeTypes = ['audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg'];
    const selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    const recorder = new MediaRecorder(dest.stream, { mimeType: selectedMime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    return new Promise(async (resolve, reject) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMime || 'audio/mp4' });
            audioCtx.close();
            if (blob.size === 0) reject(new Error("Audio export failed: Empty file"));
            else resolve(blob);
        };

        recorder.start();

        onProgress(30, "Mixing audio...");
        await audioCtx.resume();
        
        // Schedule Audio
        const startTime = audioCtx.currentTime + 0.1;
        let totalDuration = 0;
        
        loadedAudios.forEach((buffer, i) => {
            const scene = scenes[i];
            const sceneDuration = Math.max(buffer?.duration || 0, scene.manualDuration || scene.estimatedDuration || 5);
            
            if (buffer) {
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(dest);
                source.start(startTime + totalDuration);
            }
            totalDuration += sceneDuration;
        });

        // Loop check instead of setTimeout to match logic
        const loop = async () => {
             while(true) {
                 const elapsed = audioCtx.currentTime - startTime;
                 if (elapsed >= totalDuration) break;
                 
                 const p = Math.min(99, Math.round((elapsed / totalDuration) * 100));
                 onProgress(p, "Recording Audio...");
                 await new Promise(r => setTimeout(r, 500));
             }
             recorder.stop();
        };
        
        loop();
    });
};