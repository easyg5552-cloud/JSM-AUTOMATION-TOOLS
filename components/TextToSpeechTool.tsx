import React, { useState } from 'react';
import { Niche } from '../types';
import { NICHE_OPTIONS, VOICE_PROFILES } from '../constants';
import { generateSpeech } from '../services/geminiService';
import { Mic2, Download, Trash2, Play, Volume2, Loader2, Music, Languages, AlertTriangle } from 'lucide-react';

interface Props {
  onBack: () => void;
}

interface AudioResult {
  id: string;
  text: string;
  url: string;
  voice: string;
  niche: string;
  timestamp: number;
}

const TextToSpeechTool: React.FC<Props> = ({ onBack }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(VOICE_PROFILES[0].name);
  const [niche, setNiche] = useState<Niche>(Niche.Auto);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<AudioResult[]>([]);
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const charCount = text.length;
  const isLongText = charCount > 3000;

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setIsGenerating(true);
    setProgress({ current: 0, total: 0 });
    const id = Date.now().toString();
    
    try {
      const url = await generateSpeech(text, voice, (current, total) => {
          setProgress({ current, total });
      });
      
      const newResult: AudioResult = {
        id,
        text: text.trim(),
        url,
        voice,
        niche,
        timestamp: Date.now()
      };

      setResults(prev => [newResult, ...prev]);
    } catch (error: any) {
      console.error("TTS Error:", error);
      alert(`Failed to generate speech: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleDelete = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between sticky top-0 bg-[#0f172a] z-10 py-4 border-b border-slate-800/50">
         <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Mic2 className="text-emerald-400" /> AI Voice Studio
            </h1>
            <p className="text-slate-400">Convert long-form text (even 2-3 hours) into lifelike speech.</p>
         </div>
         <button 
            onClick={onBack} 
            className="text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
            Back to Studio
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl sticky top-32">
             
             {/* Text Input */}
             <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Languages size={16} /> Input Text
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`w-full h-64 bg-slate-950 border rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none scrollbar-thin text-base leading-relaxed placeholder:text-slate-600 ${
                      isLongText ? 'border-amber-500/50' : 'border-slate-800'
                  }`}
                  placeholder="Paste your script here. No limit! (Supports 15k-100k+ characters for long-form content)"
                />
                <div className="flex justify-between items-center mt-2">
                     {isLongText && (
                        <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold">
                            <AlertTriangle size={12} />
                            <span>Long text detected ({Math.ceil(charCount/3000)} chunks). Processing will be sequential.</span>
                        </div>
                     )}
                     <div className={`text-xs text-right ml-auto ${isLongText ? 'text-amber-500' : 'text-slate-500'}`}>
                        {charCount} characters
                     </div>
                </div>
             </div>

             {/* Settings */}
             <div className="grid grid-cols-2 gap-4 mb-8">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Voice Profile</label>
                  <select
                    className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-emerald-500 outline-none text-sm"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                  >
                    {VOICE_PROFILES.map(v => (
                      <option key={v.name} value={v.name}>{v.name} ({v.gender})</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mood / Niche</label>
                  <select
                    className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-emerald-500 outline-none text-sm"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value as Niche)}
                  >
                    {NICHE_OPTIONS.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
                  </select>
               </div>
             </div>

             {/* Generate Btn */}
             <button
                onClick={handleGenerate}
                disabled={!text || isGenerating}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                    !text || isGenerating
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25'
                }`}
            >
                {isGenerating ? (
                    <div className="w-full px-4">
                        <div className="flex items-center justify-between mb-2 text-xs text-white/80">
                            <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Processing...</span>
                            {progress.total > 0 && <span>{Math.round((progress.current / progress.total) * 100)}%</span>}
                        </div>
                        {progress.total > 0 && (
                            <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white/90 transition-all duration-300 ease-out"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                        )}
                        {progress.total > 0 && (
                            <div className="text-[10px] text-white/50 mt-1 text-center">
                                Converting chunk {progress.current} of {progress.total}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <Volume2 size={20} /> Generate Speech
                    </>
                )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            Generated Clips <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs">{results.length}</span>
          </h3>

          {results.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                <div className="p-4 bg-slate-800 rounded-full mb-3">
                   <Music size={32} className="text-slate-500" />
                </div>
                <p>No audio generated yet.</p>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-xs">Enter your script (even thousands of words) to get started.</p>
             </div>
          ) : (
             <div className="space-y-4">
               {results.map((res) => (
                 <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all animate-fade-in">
                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 block">
                            {res.voice} • {res.niche}
                          </span>
                          <p className="text-slate-300 text-sm line-clamp-2 italic">"{res.text.slice(0, 100)}..."</p>
                       </div>
                       <button onClick={() => handleDelete(res.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                       </button>
                    </div>

                    <div className="bg-slate-950 rounded-lg p-2 flex items-center gap-3">
                       <audio controls src={res.url} className="w-full h-8 opacity-90" />
                       <a 
                         href={res.url} 
                         download={`speech-${res.id}.wav`}
                         className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                         title="Download WAV"
                       >
                         <Download size={18} />
                       </a>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TextToSpeechTool;