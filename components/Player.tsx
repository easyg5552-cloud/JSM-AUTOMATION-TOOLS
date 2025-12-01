import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Scene } from '../types';
import { Play, Pause, SkipBack, SkipForward, Download, X, Clock } from 'lucide-react';

interface Props {
  scenes: Scene[];
  initialSceneIndex?: number;
  onClose: () => void;
  onExport: () => void;
  onUpdateScene?: (scene: Scene) => void;
}

const Player: React.FC<Props> = ({ scenes, initialSceneIndex = 0, onClose, onExport, onUpdateScene }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(initialSceneIndex);
  const [sceneProgress, setSceneProgress] = useState(0); // Progress of current scene (0-100)
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-calculate timeline data
  const timeline = useMemo(() => {
    let accumulated = 0;
    return scenes.map(s => {
      const duration = Math.max(s.manualDuration || s.audioDuration || s.estimatedDuration || 5, s.audioDuration || 0);
      const start = accumulated;
      accumulated += duration;
      return { ...s, duration, start, end: accumulated };
    });
  }, [scenes]);

  const totalDuration = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;
  const currentSceneData = timeline[currentSceneIndex];

  // Helper: Get global time
  const getGlobalTime = () => {
    if (!currentSceneData) return 0;
    const sceneTime = (sceneProgress / 100) * currentSceneData.duration;
    return currentSceneData.start + sceneTime;
  };

  const globalTime = getGlobalTime();

  // 1. Initialize Audio Instance (Run Once)
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // 2. Handle Scene Loading
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSceneData) return;

    const loadSceneAudio = async () => {
        // Reset state for new scene
        audio.pause();
        setSceneProgress(0);

        if (currentSceneData.audioUrl) {
            audio.src = currentSceneData.audioUrl;
            audio.load();
            
            // If we are currently in "Playing" state, resume playback for the new scene
            if (isPlaying) {
                try {
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            if (error.name !== 'AbortError') {
                                console.error("Playback failed", error);
                            }
                        });
                    }
                } catch (e) {
                    console.error("Play error", e);
                }
            }
        } else {
            audio.src = '';
        }
    };

    loadSceneAudio();
  }, [currentSceneIndex, currentSceneData?.audioUrl]); // Only re-run if index or URL changes

  // 3. Handle Play/Pause Toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSceneData) return;

    if (isPlaying) {
        if (audio.src && audio.paused) {
             const playPromise = audio.play();
             if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name !== 'AbortError') console.error("Resume failed", error);
                });
             }
        }
    } else {
        if (!audio.paused) {
            audio.pause();
        }
    }
  }, [isPlaying]);

  // 4. Handle Playback Ending (Sync with React State)
  useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const onEnded = () => {
        handleSceneEnd();
      };

      audio.onended = onEnded;
      return () => { audio.onended = null; };
  }, [currentSceneIndex, timeline]); // Re-bind to capture correct index closure

  // 5. Progress Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const updateLoop = () => {
        const audio = audioRef.current;
        if (!currentSceneData) return;

        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        if (isPlaying) {
            // Priority 1: Sync with Audio Element
            if (audio && !audio.paused && audio.duration > 0) {
                 const currentTime = audio.currentTime;
                 setSceneProgress((currentTime / currentSceneData.duration) * 100);
            } 
            // Priority 2: Manual Timer (for scenes without audio or extended duration)
            else {
                // Calculate current time in seconds based on progress
                const currentSceneTime = (sceneProgress / 100) * currentSceneData.duration;
                
                // If audio finished but scene duration is longer (manual override)
                const isAudioFinished = audio && audio.ended;
                const hasNoAudio = !audio || !audio.src;
                
                if (hasNoAudio || (isAudioFinished && currentSceneTime < currentSceneData.duration)) {
                     const newTime = currentSceneTime + dt;
                     if (newTime >= currentSceneData.duration) {
                         handleSceneEnd();
                     } else {
                         setSceneProgress((newTime / currentSceneData.duration) * 100);
                     }
                }
            }
        }

        animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentSceneData, sceneProgress]);


  // Auto-play on mount if starting from a specific scene
  useEffect(() => {
      if (initialSceneIndex !== 0) {
          setIsPlaying(true);
      }
  }, []);

  const handleSceneEnd = () => {
    if (currentSceneIndex < timeline.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentSceneIndex(0); 
      setSceneProgress(0);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const skip = (direction: 'prev' | 'next') => {
    let newIndex = direction === 'next' ? currentSceneIndex + 1 : currentSceneIndex - 1;
    newIndex = Math.max(0, Math.min(newIndex, timeline.length - 1));
    setCurrentSceneIndex(newIndex);
  };

  const handleGlobalScrub = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const targetTime = percent * totalDuration;

      // Find scene
      const targetSceneIndex = timeline.findIndex(s => targetTime >= s.start && targetTime < s.end);
      if (targetSceneIndex !== -1) {
          setCurrentSceneIndex(targetSceneIndex);
          const scene = timeline[targetSceneIndex];
          const timeInScene = targetTime - scene.start;
          const newProgress = (timeInScene / scene.duration) * 100;
          setSceneProgress(newProgress);
          
          if (audioRef.current && scene.audioUrl) {
               audioRef.current.currentTime = Math.min(timeInScene, audioRef.current.duration || 0);
               if (isPlaying) {
                   audioRef.current.play().catch(() => {});
               }
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 md:p-8 animate-fade-in">
      <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
        <X size={32} />
      </button>

      <div ref={containerRef} className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
        {/* Visual Layer */}
        {currentSceneData?.imageUrl ? (
          <img 
            src={currentSceneData.imageUrl} 
            className={`w-full h-full object-cover transition-all duration-[10000ms] ease-linear ${isPlaying ? 'scale-110' : 'scale-100'}`}
            alt="Scene"
          />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-slate-500">No Image</div>
        )}

        {/* Subtitles Overlay */}
        <div className="absolute bottom-16 left-0 right-0 text-center px-8">
           <span className="bg-black/60 text-white text-lg md:text-xl px-4 py-2 rounded-lg box-decoration-clone leading-[2.5rem] backdrop-blur-sm">
             {currentSceneData?.scriptText}
           </span>
        </div>
        
        {/* Top Info Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
             <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 border border-white/10">
                 {currentSceneData ? `${globalTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s` : '00:00'}
             </div>
             
             {/* Scene Duration Editor */}
             {onUpdateScene && currentSceneData && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 group">
                    <Clock size={12} className="text-indigo-400" />
                    <span className="text-xs text-slate-400">Duration:</span>
                    <input 
                        type="number"
                        step="0.5"
                        min="1"
                        className="w-12 bg-transparent text-white text-xs font-bold border-b border-indigo-500/50 focus:border-indigo-500 outline-none text-center"
                        value={currentSceneData.manualDuration || currentSceneData.duration.toFixed(1)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val > 0) {
                                onUpdateScene({ ...currentSceneData, manualDuration: val });
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-slate-500">s</span>
                </div>
             )}
        </div>
      </div>

      {/* Global Timeline & Controls */}
      <div className="w-full max-w-5xl mt-6 space-y-4">
         
         {/* Scrubber */}
         <div 
            className="w-full h-10 bg-slate-900 rounded-lg border border-slate-800 relative cursor-pointer group overflow-hidden"
            onClick={handleGlobalScrub}
            onMouseMove={(e) => { if (e.buttons === 1) handleGlobalScrub(e); }}
         >
             {/* Scene Segments Background */}
             <div className="absolute inset-0 flex">
                 {timeline.map((s, i) => (
                     <div 
                        key={s.id} 
                        style={{ width: `${(s.duration / totalDuration) * 100}%` }}
                        className={`h-full border-r border-slate-800/50 ${i === currentSceneIndex ? 'bg-indigo-500/10' : 'bg-transparent'} hover:bg-white/5 transition-colors`}
                        title={`Scene ${i+1}`}
                     ></div>
                 ))}
             </div>
             
             {/* Global Progress Fill */}
             <div 
                className="absolute top-0 bottom-0 left-0 bg-indigo-500/30 border-r-2 border-indigo-400 pointer-events-none transition-all duration-75"
                style={{ width: `${(globalTime / totalDuration) * 100}%` }}
             ></div>
         </div>

         {/* Transport Controls */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">Scene {currentSceneIndex + 1} of {scenes.length}</span>
            </div>

            <div className="flex items-center gap-6">
                <button onClick={() => skip('prev')} className="p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"><SkipBack size={20} /></button>
                <button 
                onClick={togglePlay} 
                className="p-4 rounded-full bg-white text-black hover:bg-slate-200 transition-transform active:scale-95 shadow-xl shadow-white/10"
                >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={() => skip('next')} className="p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"><SkipForward size={20} /></button>
            </div>

            <button onClick={onExport} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium px-4 py-2 hover:bg-indigo-500/10 rounded-lg transition-colors">
                <Download size={16} /> Export Video
            </button>
         </div>
      </div>
    </div>
  );
};

export default Player;