import React, { useState } from 'react';
import { Scene, GenerationState, ExportFormat } from '../types';
import { Play, Image as ImageIcon, RefreshCw, Clock, CheckCircle2, Download, Loader2, AlertTriangle, Wand2, Mic, XCircle, ChevronDown, Edit2, PlayCircle } from 'lucide-react';

interface Props {
  scenes: Scene[];
  generationState: GenerationState;
  onRegenerateImage: (scene: Scene) => void;
  onRegenerateAudio: (scene: Scene) => void;
  onUpdateScene?: (scene: Scene) => void;
  onPreview: (startIndex?: number) => void;
  onExport: (format: ExportFormat) => void;
}

const Storyboard: React.FC<Props> = ({ scenes, generationState, onRegenerateImage, onRegenerateAudio, onUpdateScene, onPreview, onExport }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  
  const readyCount = scenes.filter(s => s.status === 'ready').length;
  const progressPercent = scenes.length > 0 ? Math.round((readyCount / scenes.length) * 100) : 0;
  const allReady = readyCount === scenes.length && scenes.length > 0;

  const getStatusBadge = (status: Scene['status']) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider"><Clock size={12} /> Queue</span>;
      case 'generating_image':
        return <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold uppercase tracking-wider animate-pulse"><Wand2 size={12} /> Visualizing</span>;
      case 'generating_audio':
        return <span className="flex items-center gap-1.5 text-[10px] text-purple-400 font-bold uppercase tracking-wider animate-pulse"><Mic size={12} /> Voicing</span>;
      case 'ready':
        return <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider"><CheckCircle2 size={12} /> Ready</span>;
      case 'error':
        return <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold uppercase tracking-wider"><AlertTriangle size={12} /> Failed</span>;
      default: return null;
    }
  };

  const getCardStyle = (status: Scene['status']) => {
    switch (status) {
      case 'generating_image':
      case 'generating_audio':
        return 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-slate-900/80';
      case 'ready':
        return 'border-emerald-500/20 bg-slate-900/60 hover:border-emerald-500/40 transition-colors';
      case 'error':
        return 'border-red-500/30 bg-red-950/20';
      default:
        return 'border-white/5 bg-slate-900/40 opacity-70';
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent" onClick={() => { setShowExportMenu(false); setEditingDurationId(null); }}>
      
      {/* Cinematic Header */}
      <div className="bg-black/40 backdrop-blur-xl border-b border-white/5 p-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
        <div>
           <div className="flex items-center gap-3">
             <h2 className="text-xl font-bold text-white tracking-tight">Timeline</h2>
             <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase tracking-wide">{scenes.length} Scenes</span>
           </div>
           
           <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-medium">
             {generationState.status === 'generating_assets' && <Loader2 size={12} className="animate-spin text-indigo-400" />}
             <span className={generationState.status === 'generating_assets' ? 'text-indigo-300' : ''}>{generationState.currentStep}</span>
             
             {scenes.length > 0 && (
                <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
             )}
           </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!allReady}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 border transition-all active:scale-95 ${
                allReady
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-slate-300 shadow-lg'
                    : 'bg-white/5 border-transparent text-slate-600 cursor-not-allowed'
                }`}
            >
                <Download size={14} /> <span className="hidden sm:inline">Export</span> <ChevronDown size={12} />
            </button>
            
            {showExportMenu && allReady && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[#0B0F15] backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden ring-1 ring-white/5">
                    <button onClick={() => onExport(ExportFormat.Video1080p)} className="w-full text-left px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white flex justify-between items-center transition-colors">
                        Video 1080p <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20">HD</span>
                    </button>
                    <button onClick={() => onExport(ExportFormat.Video4K)} className="w-full text-left px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white flex justify-between items-center transition-colors">
                        Video 4K <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">UHD</span>
                    </button>
                </div>
            )}
          </div>

          <button
            onClick={() => onPreview(0)}
            disabled={readyCount === 0}
            className={`px-6 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 ${
              readyCount > 0 
                ? 'bg-white text-black hover:bg-slate-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
            }`}
          >
            <Play size={14} fill="currentColor" /> Play All
          </button>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {scenes.map((scene, index) => (
          <div 
            key={scene.id} 
            className={`rounded-xl overflow-hidden flex flex-col md:flex-row border backdrop-blur-md transition-all duration-500 ${getCardStyle(scene.status)}`}
          >
            
            {/* Visual Asset Thumbnail */}
            <div className="w-full md:w-72 aspect-video bg-black/50 relative group shrink-0 border-r border-white/5">
              {scene.imageUrl ? (
                <>
                    <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                    
                    {scene.status === 'ready' && (
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[1px]" onClick={() => onPreview(index)}>
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white hover:scale-110 transition-transform shadow-xl">
                                <Play size={20} fill="currentColor" className="ml-1" />
                            </div>
                         </div>
                    )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-[#080B10]">
                   {scene.status === 'generating_image' ? (
                      <Loader2 className="animate-spin text-indigo-500" size={24} />
                   ) : (
                      <ImageIcon size={28} className="opacity-20" />
                   )}
                </div>
              )}
              
              {/* Overlay Actions */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                     onClick={(e) => { e.stopPropagation(); onRegenerateImage(scene); }}
                     className="p-1.5 bg-black/70 hover:bg-black rounded text-white backdrop-blur-md border border-white/10 transition-colors"
                     title="Regenerate Image"
                  >
                    <RefreshCw size={12} />
                  </button>
              </div>
              
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                SCENE {index + 1}
              </div>
            </div>

            {/* Content Details */}
            <div className="flex-1 p-5 flex flex-col justify-between relative">
               <div>
                 <div className="flex items-center justify-between mb-3">
                   {getStatusBadge(scene.status)}
                   
                   <div 
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-black/20 border border-white/5 px-2 py-1 rounded cursor-pointer hover:border-white/20 transition-all"
                      onClick={(e) => { e.stopPropagation(); setEditingDurationId(scene.id); }}
                   >
                     <Clock size={10} /> 
                     {editingDurationId === scene.id ? (
                        <input
                           type="number"
                           step="0.5"
                           min="0.5"
                           autoFocus
                           className="w-8 bg-transparent text-white border-b border-indigo-500 outline-none text-center"
                           value={scene.manualDuration || scene.estimatedDuration}
                           onChange={(e) => {
                             if(onUpdateScene) {
                               onUpdateScene({ ...scene, manualDuration: parseFloat(e.target.value) });
                             }
                           }}
                           onBlur={() => setEditingDurationId(null)}
                           onKeyDown={(e) => { if(e.key === 'Enter') setEditingDurationId(null) }}
                        />
                     ) : (
                        <span>{scene.manualDuration || scene.estimatedDuration}s</span>
                     )}
                   </div>
                 </div>
                 
                 <p className="text-slate-200 text-sm leading-relaxed font-medium line-clamp-2 md:line-clamp-3">
                   "{scene.scriptText}"
                 </p>
               </div>

               {/* Asset Controls */}
               <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                 {scene.status === 'error' ? (
                    <div className="flex items-center gap-3 text-red-400">
                        <span className="text-xs truncate max-w-[200px]">{scene.error}</span>
                        {!scene.audioUrl && <button onClick={() => onRegenerateAudio(scene)} className="text-[10px] underline">Retry Audio</button>}
                    </div>
                 ) : (
                    <div className="flex items-center gap-4">
                        {scene.audioUrl ? (
                            <button 
                                onClick={() => { new Audio(scene.audioUrl).play(); }} 
                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                                <Play size={10} fill="currentColor" /> Play Voice
                            </button>
                        ) : scene.status === 'generating_audio' ? (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Synthesizing</span>
                        ) : (
                            <button onClick={() => onRegenerateAudio(scene)} className="text-[10px] text-indigo-400 hover:text-white transition-colors">
                                Generate Voice
                            </button>
                        )}
                    </div>
                 )}
               </div>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {scenes.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-slate-600 border border-white/5 rounded-2xl bg-[#0B0F15]">
             <Wand2 size={32} className="mb-3 opacity-20" />
             <p className="text-sm font-medium opacity-50">Timeline Empty</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Storyboard;