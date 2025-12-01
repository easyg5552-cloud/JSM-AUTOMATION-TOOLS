import React, { useState } from 'react';
import Configuration from './components/Configuration';
import Storyboard from './components/Storyboard';
import Player from './components/Player';
import BulkImageGenerator from './components/BulkImageGenerator';
import TextToSpeechTool from './components/TextToSpeechTool';
import ScriptGeneratorTool from './components/ScriptGeneratorTool';
import { VideoConfig, Scene, GenerationState, Niche, ExportFormat } from './types';
import { DEFAULT_CONFIG } from './constants';
import { analyzeScript, generateSceneImage, generateSceneAudio } from './services/geminiService';
import { exportVideo } from './services/videoExporter';
import { Download, Loader2, LayoutGrid, PlusCircle, Mic2, Sparkles, Video, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<VideoConfig>(DEFAULT_CONFIG);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [mode, setMode] = useState<'config' | 'storyboard' | 'player' | 'bulk' | 'tts' | 'script'>('config');
  const [generationState, setGenerationState] = useState<GenerationState>({
    status: 'idle',
    progress: 0,
    currentStep: 'Idle'
  });
  const [playerStartIndex, setPlayerStartIndex] = useState(0);
  
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  // Pipeline Execution
  const startGeneration = async () => {
    if (!process.env.API_KEY) {
      alert("API Key missing in environment variables.");
      return;
    }

    setMode('storyboard');
    setGenerationState({ status: 'analyzing', progress: 5, currentStep: 'Analyzing Script...' });

    try {
      // 1. Analyze Script
      const { scenes: analyzedScenes, detectedNiche } = await analyzeScript(config);
      
      if (config.niche === Niche.Auto) {
        console.log(`Detected niche: ${detectedNiche}`);
      }

      setScenes(analyzedScenes);
      setGenerationState({ status: 'generating_assets', progress: 20, currentStep: 'Generating Assets...' });

      // 2. Parallel Generation (Sequenced for rate limits/logic)
      const totalAssets = analyzedScenes.length * 2;
      let assetsCompleted = 0;

      const newScenes = [...analyzedScenes];

      for (let i = 0; i < newScenes.length; i++) {
        const scene = newScenes[i];
        
        // Generate Image
        setGenerationState({ status: 'generating_assets', progress: 20 + (assetsCompleted / totalAssets) * 80, currentStep: `Creating visual for Scene ${i+1}` });
        newScenes[i].status = 'generating_image';
        setScenes([...newScenes]);
        
        try {
           const imageUrl = await generateSceneImage(scene, config);
           newScenes[i].imageUrl = imageUrl;
        } catch (e: any) {
           console.error(`Image fail scene ${i}`, e);
           newScenes[i].error = e.message || 'Image generation failed';
        }
        
        assetsCompleted++;

        // Generate Audio
        setGenerationState({ status: 'generating_assets', progress: 20 + (assetsCompleted / totalAssets) * 80, currentStep: `Synthesizing voice for Scene ${i+1}` });
        newScenes[i].status = 'generating_audio';
        setScenes([...newScenes]);

        try {
          const audioUrl = await generateSceneAudio(scene, config);
          newScenes[i].audioUrl = audioUrl;
          
          // Try to get audio duration
          try {
            const tempAudio = new Audio(audioUrl);
            await new Promise((resolve) => {
              tempAudio.onloadedmetadata = () => {
                newScenes[i].audioDuration = tempAudio.duration;
                resolve(null);
              };
              tempAudio.onerror = () => resolve(null);
              // Timeout in case it hangs
              setTimeout(() => resolve(null), 2000);
            });
          } catch (err) {
            console.warn("Could not determine audio duration", err);
          }

        } catch (e: any) {
           console.error(`Audio fail scene ${i}`, e);
           newScenes[i].error = e.message || 'Audio generation failed';
        }
        
        assetsCompleted++;
        
        if (newScenes[i].error) {
            newScenes[i].status = 'error';
        } else {
            newScenes[i].status = 'ready';
        }
        setScenes([...newScenes]);

        // Add a SUBSTANTIAL delay to avoid rate limits (5 seconds between scenes)
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      setGenerationState({ status: 'ready', progress: 100, currentStep: 'Complete' });

    } catch (error) {
      console.error("Pipeline error:", error);
      setGenerationState({ status: 'idle', progress: 0, currentStep: 'Error occurred' });
      alert("An error occurred during generation. Check console for details.");
      setMode('config');
    }
  };

  const handleUpdateScene = (updatedScene: Scene) => {
    setScenes(prev => prev.map(s => s.id === updatedScene.id ? updatedScene : s));
  };

  const handleRegenerateImage = async (sceneToUpdate: Scene) => {
    const updatedScenes = scenes.map(s => s.id === sceneToUpdate.id ? { ...s, status: 'generating_image' as const, error: undefined } : s);
    setScenes(updatedScenes);
    
    try {
      const url = await generateSceneImage(sceneToUpdate, config);
      setScenes(prev => prev.map(s => s.id === sceneToUpdate.id ? { ...s, imageUrl: url, status: 'ready', error: undefined } : s));
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || 'Image generation failed';
      setScenes(prev => prev.map(s => s.id === sceneToUpdate.id ? { ...s, status: 'error', error: errorMessage } : s));
    }
  };

  const handleRegenerateAudio = async (sceneToUpdate: Scene) => {
    const updatedScenes = scenes.map(s => s.id === sceneToUpdate.id ? { ...s, status: 'generating_audio' as const, error: undefined } : s);
    setScenes(updatedScenes);

    try {
      const audioUrl = await generateSceneAudio(sceneToUpdate, config);
      let duration = sceneToUpdate.audioDuration;

      // Try to get audio duration
      try {
        const tempAudio = new Audio(audioUrl);
        await new Promise((resolve) => {
            tempAudio.onloadedmetadata = () => {
            duration = tempAudio.duration;
            resolve(null);
            };
            tempAudio.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 2000);
        });
      } catch (err) {
        console.warn("Could not determine audio duration", err);
      }

      setScenes(prev => prev.map(s => s.id === sceneToUpdate.id ? { ...s, audioUrl, audioDuration: duration, status: 'ready', error: undefined } : s));
    } catch (e: any) {
       console.error("Audio regen failed", e);
       const errorMessage = e.message || 'Audio generation failed';
       setScenes(prev => prev.map(s => s.id === sceneToUpdate.id ? { ...s, status: 'error', error: errorMessage } : s));
    }
  };

  const handleExportVideo = async (format: ExportFormat = ExportFormat.Video1080p) => {
    const readyScenes = scenes.filter(s => s.status === 'ready' && s.imageUrl && s.audioUrl);
    if (readyScenes.length === 0) {
      alert("No ready scenes to export.");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Initializing export...');

    try {
      const blob = await exportVideo(readyScenes, {
        aspectRatio: config.imageAspect,
        format: format,
        onProgress: (p, s) => {
          setExportProgress(p);
          setExportStatus(s);
        }
      });

      // Trigger Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let ext = 'mp4';
      if (format === ExportFormat.AudioOnly) {
          ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : 'wav';
      } else if (blob.type.includes('webm')) {
          ext = 'webm';
      }

      const qualityLabel = format.replace('video_', '').replace('audio_only', 'audio');
      const filename = `vidgen_${config.niche}_${qualityLabel}_${new Date().toISOString().slice(0,10)}.${ext}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed", error);
      alert("Export failed. See console for details.");
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleUseGeneratedScript = (scriptText: string, niche: Niche) => {
      setConfig(prev => ({
          ...prev,
          scriptText,
          niche
      }));
      setMode('config');
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative bg-[#0B0F19]">
      
      {/* Deep Space Background Mesh */}
      <div className="fixed inset-0 z-[-1]">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]"></div>
          <div className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full bg-cyan-900/10 blur-[100px]"></div>
      </div>
      
      {/* Tech Grid Pattern */}
      <div className="fixed inset-0 z-[-1] opacity-[0.05] pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
           }}>
      </div>

      {/* Glass Header */}
      {mode !== 'player' && (
        <header className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setMode('config')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-transform group-hover:scale-105">
              <Video size={16} fill="currentColor" className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white/90">VidGen<span className="text-indigo-400">Studio</span></span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {mode === 'storyboard' && (
              <button 
                  onClick={() => handleExportVideo(ExportFormat.Video1080p)}
                  disabled={isExporting || scenes.filter(s => s.status === 'ready').length === 0}
                  className="hidden md:flex text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 items-center gap-2 px-4 py-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                >
                  <Download size={14} /> Quick Export
              </button>
            )}

            <nav className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                <button 
                onClick={() => setMode('bulk')}
                className={`text-xs font-semibold flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${mode === 'bulk' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                <LayoutGrid size={14} /> <span className="hidden sm:inline">Images</span>
                </button>

                <button 
                onClick={() => setMode('tts')}
                className={`text-xs font-semibold flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${mode === 'tts' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                <Mic2 size={14} /> <span className="hidden sm:inline">Voice</span>
                </button>

                <button 
                onClick={() => setMode('script')}
                className={`text-xs font-semibold flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${mode === 'script' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                <FileText size={14} /> <span className="hidden sm:inline">Script</span>
                </button>

                <button 
                onClick={() => setMode('config')}
                className={`text-xs font-semibold flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${mode === 'config' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                <PlusCircle size={14} /> <span className="hidden sm:inline">Create</span>
                </button>
            </nav>
          </div>
        </header>
      )}

      <main className="relative h-[calc(100vh-4rem)]">
        {mode === 'config' && (
           <div className="h-full overflow-y-auto py-8 md:py-12 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
             <Configuration 
               config={config} 
               onChange={setConfig} 
               onStart={startGeneration}
               isProcessing={generationState.status !== 'idle' && generationState.status !== 'ready'} 
             />
           </div>
        )}

        {mode === 'storyboard' && (
          <Storyboard 
            scenes={scenes}
            generationState={generationState}
            onRegenerateImage={handleRegenerateImage}
            onRegenerateAudio={handleRegenerateAudio}
            onUpdateScene={handleUpdateScene}
            onPreview={(index) => {
               setPlayerStartIndex(index || 0);
               setMode('player');
            }}
            onExport={handleExportVideo}
          />
        )}

        {mode === 'player' && (
          <Player 
            scenes={scenes}
            initialSceneIndex={playerStartIndex}
            onUpdateScene={handleUpdateScene}
            onClose={() => setMode('storyboard')} 
            onExport={() => handleExportVideo(ExportFormat.Video1080p)}
          />
        )}

        {mode === 'bulk' && (
          <BulkImageGenerator onBack={() => setMode('config')} />
        )}

        {mode === 'tts' && (
          <TextToSpeechTool onBack={() => setMode('config')} />
        )}
        
        {mode === 'script' && (
            <ScriptGeneratorTool 
                onBack={() => setMode('config')} 
                onUseScript={handleUseGeneratedScript}
            />
        )}
      </main>

      {/* Cinematic Export Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-10 blur-xl"></div>
            
            <div className="relative z-10 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <Loader2 size={32} className="animate-spin text-indigo-400" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Rendering Masterpiece</h3>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed">Processing high-fidelity assets and synthesizing final timeline.<br/>Please keep this tab open.</p>
                
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4 border border-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    style={{ width: `${exportProgress}%` }}
                ></div>
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                    <span>{exportStatus}</span>
                    <span className="text-indigo-400">{exportProgress}%</span>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;