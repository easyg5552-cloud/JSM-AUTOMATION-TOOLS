import React, { useRef } from 'react';
import { VideoConfig } from '../types';
import { NICHE_OPTIONS, STYLE_OPTIONS, ASPECT_OPTIONS, VOICE_PROFILES, SAFETY_OPTIONS, TRANSITION_OPTIONS } from '../constants';
import { Film, Wand2, Volume2, Shield, Clock, Users, Sparkles, ChevronDown, Layers, Palette, Grid, ImagePlus, X } from 'lucide-react';

interface Props {
  config: VideoConfig;
  onChange: (newConfig: VideoConfig) => void;
  onStart: () => void;
  isProcessing: boolean;
}

const Configuration: React.FC<Props> = ({ config, onChange, onStart, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (field: keyof VideoConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('referenceImage', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    handleChange('referenceImage', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const wordCount = config.scriptText ? config.scriptText.trim().split(/\s+/).length : 0;
  const estimatedReadTimeMin = Math.max(1, Math.ceil(wordCount / 150));

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="relative max-w-6xl mx-auto">
        
      {/* Background Glow Mesh */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-[2.5rem] blur-xl opacity-20"></div>

      <div className="relative bg-[#0F141F]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        
        {/* Header Section */}
        <div className="px-8 py-10 md:text-center border-b border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-4 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                <Sparkles size={10} /> AI Production Suite
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
             Design Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">Masterpiece</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed font-light">
                Orchestrate a fully produced video with neural voice synthesis, cinematic visuals, and automated editing.
            </p>
        </div>

        <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* Left Column: Script & Creative Core */}
            <div className="lg:col-span-7 space-y-8">
                
                {/* Script Editor */}
                <div className="space-y-4 group">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <div className="p-1.5 rounded bg-indigo-500/20 text-indigo-400"><Film size={14} /></div>
                            Screenplay / Prompt
                        </label>
                        <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5 group-focus-within:border-indigo-500/30 group-focus-within:text-indigo-400 transition-colors">
                            {wordCount} words • ~{estimatedReadTimeMin}m read
                        </span>
                    </div>
                    
                    <div className="relative">
                        <textarea
                            className="w-full h-80 bg-[#0B0F15] border border-white/10 rounded-2xl p-6 text-slate-200 text-lg leading-relaxed focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all resize-none shadow-inner placeholder:text-slate-700 scrollbar-thin"
                            value={config.scriptText}
                            onChange={(e) => handleChange('scriptText', e.target.value)}
                            placeholder="Start writing your story here... The AI will analyze scene by scene."
                        />
                        {/* Editor Lines Decoration */}
                        <div className="absolute top-6 right-6 pointer-events-none opacity-20 flex gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                        </div>
                    </div>
                </div>

                {/* Character Consistency Panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} /> Character Consistency
                    </label>
                    <textarea
                        className="w-full h-20 bg-transparent border-b border-white/10 text-slate-300 text-sm focus:border-indigo-500/50 outline-none resize-none placeholder:text-slate-600 focus:bg-white/[0.02] rounded-lg px-2 transition-all"
                        value={config.characterConsistency || ''}
                        onChange={(e) => handleChange('characterConsistency', e.target.value)}
                        placeholder="Define persistent characters (e.g., 'Protagonist: 30yo man, beard, red jacket')."
                    />
                </div>
            </div>

            {/* Right Column: Settings Dashboard */}
            <div className="lg:col-span-5 space-y-8">
                
                {/* 1. Style & Niche Widgets */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0B0F15] p-4 rounded-2xl border border-white/5 space-y-3 hover:border-white/10 transition-colors group">
                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <Palette size={14} />
                            <label className="text-[10px] font-bold uppercase tracking-widest">Aesthetic</label>
                        </div>
                        
                        <div className="relative">
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-medium focus:bg-white/10 focus:border-indigo-500/50 outline-none appearance-none cursor-pointer"
                                value={config.visualStyle}
                                onChange={(e) => handleChange('visualStyle', e.target.value)}
                            >
                                {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>

                         {/* Reference Image Input */}
                        <div className="mt-2">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload}
                            />
                            {config.referenceImage ? (
                                <div className="relative w-full h-12 rounded-lg border border-white/10 overflow-hidden group/ref">
                                    <img src={config.referenceImage} alt="Ref" className="w-full h-full object-cover opacity-60" />
                                    <button 
                                        onClick={removeReferenceImage}
                                        className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover/ref:opacity-100 transition-opacity"
                                    >
                                        <X size={16} />
                                    </button>
                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white">Ref</div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2 border border-dashed border-white/10 rounded-lg text-slate-500 text-[10px] hover:text-indigo-400 hover:border-indigo-500/30 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <ImagePlus size={12} /> Ref Image (Optional)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#0B0F15] p-4 rounded-2xl border border-white/5 space-y-3 hover:border-white/10 transition-colors group">
                         <div className="flex items-center gap-2 text-slate-500 group-hover:text-purple-400 transition-colors">
                            <Layers size={14} />
                            <label className="text-[10px] font-bold uppercase tracking-widest">Genre</label>
                        </div>
                        <div className="relative">
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-medium focus:bg-white/10 focus:border-purple-500/50 outline-none appearance-none cursor-pointer"
                                value={config.niche}
                                onChange={(e) => handleChange('niche', e.target.value)}
                            >
                                {NICHE_OPTIONS.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* 2. Voice Selector - Card Grid */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Volume2 size={12} /> Narrator Voice
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {VOICE_PROFILES.map(voice => {
                            const isSelected = config.voiceProfile.name === voice.name;
                            return (
                                <button
                                    key={voice.name}
                                    onClick={() => handleChange('voiceProfile', voice)}
                                    className={`relative p-3 rounded-xl border text-left transition-all duration-300 flex items-center gap-3 overflow-hidden ${
                                        isSelected 
                                        ? 'bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                                        : 'bg-[#0B0F15] border-white/5 hover:bg-white/5 hover:border-white/10'
                                    }`}
                                >
                                    {/* Selection Glow Indicator */}
                                    {isSelected && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>}
                                    
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                        isSelected ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/10 text-slate-400'
                                    }`}>
                                        {voice.name[0]}
                                    </div>
                                    <div className="relative z-10">
                                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>{voice.name}</div>
                                        <div className="text-[10px] text-slate-500">{voice.gender} • {voice.style.split(',')[0]}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Duration & Tech Specs */}
                <div className="bg-[#0B0F15] rounded-2xl p-5 border border-white/5 space-y-6">
                     <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} /> Duration Target
                            </label>
                            <span className="text-xs font-mono font-bold text-indigo-300">{formatDuration(config.targetDurationMinutes)}</span>
                        </div>
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                             <div className="absolute h-full bg-indigo-500 rounded-full" style={{ width: `${(config.targetDurationMinutes / 180) * 100}%` }}></div>
                             <input 
                                type="range" 
                                min="1" 
                                max="180" 
                                step="1"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={config.targetDurationMinutes}
                                onChange={(e) => handleChange('targetDurationMinutes', parseInt(e.target.value))}
                             />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-600 font-mono uppercase">
                            <span>1m</span>
                            <span>3h</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                        <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block text-center">Ratio</span>
                            <select 
                                className="w-full bg-white/5 text-xs text-center py-1.5 rounded-lg border border-white/5 focus:border-indigo-500/30 outline-none"
                                value={config.imageAspect}
                                onChange={(e) => handleChange('imageAspect', e.target.value)}
                            >
                                {ASPECT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block text-center">Transition</span>
                            <select 
                                className="w-full bg-white/5 text-xs text-center py-1.5 rounded-lg border border-white/5 focus:border-indigo-500/30 outline-none"
                                value={config.transitionType}
                                onChange={(e) => handleChange('transitionType', e.target.value)}
                            >
                                {TRANSITION_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block text-center">Safety</span>
                            <select 
                                className="w-full bg-white/5 text-xs text-center py-1.5 rounded-lg border border-white/5 focus:border-indigo-500/30 outline-none"
                                value={config.safetyMode}
                                onChange={(e) => handleChange('safetyMode', e.target.value)}
                            >
                                {SAFETY_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                        </div>
                     </div>
                </div>

                {/* 4. Action Button */}
                <button
                    onClick={onStart}
                    disabled={isProcessing || !config.scriptText}
                    className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] duration-300 relative overflow-hidden group shadow-2xl ${
                    isProcessing || !config.scriptText
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                        : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white border border-indigo-400/20 shadow-indigo-500/30'
                    }`}
                >
                    {isProcessing ? (
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span className="text-white/80 tracking-wide">Processing...</span>
                        </div>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            <Wand2 size={22} className="relative z-10" /> 
                            <span className="relative z-10 tracking-wide">Initialize Production</span>
                        </>
                    )}
                </button>
                
                {!isProcessing && (
                    <div className="text-center">
                         <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                             <Shield size={10} /> Secure AI Processing Environment
                         </span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Configuration;