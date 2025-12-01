import React, { useState } from 'react';
import { Niche } from '../types';
import { NICHE_OPTIONS } from '../constants';
import { generateCreativeScript } from '../services/geminiService';
import { FileText, PenTool, Loader2, Copy, Check, ChevronRight, Wand2, AlignLeft, Clock } from 'lucide-react';

interface Props {
  onBack: () => void;
  onUseScript: (script: string, niche: Niche) => void;
}

const ScriptGeneratorTool: React.FC<Props> = ({ onBack, onUseScript }) => {
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState<Niche>(Niche.Auto);
  const [duration, setDuration] = useState(1);
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setCopied(false);

    try {
        const script = await generateCreativeScript(topic, niche, duration);
        setGeneratedScript(script);
    } catch (error) {
        console.error("Script gen error:", error);
        alert("Failed to generate script. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between sticky top-0 bg-[#0f172a] z-10 py-4 border-b border-slate-800/50">
         <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <FileText className="text-amber-400" /> AI Script Writer
            </h1>
            <p className="text-slate-400">Generate engaging, viral-ready video scripts in seconds.</p>
         </div>
         <button 
            onClick={onBack} 
            className="text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
            Back to Studio
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
        
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                        <PenTool size={16} /> Topic / Idea
                    </label>
                    <textarea 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                        placeholder="E.g. The history of the Roman Empire, 5 tips for better sleep, A spooky ghost story in an abandoned mansion..."
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Niche</label>
                        <select
                            className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-amber-500 outline-none text-sm"
                            value={niche}
                            onChange={(e) => setNiche(e.target.value as Niche)}
                        >
                            {NICHE_OPTIONS.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (Minutes)</label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                max="120"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value))}
                                className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-amber-500 outline-none text-sm pl-9"
                            />
                            <Clock size={14} className="absolute left-3 top-3 text-slate-500" />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={!topic || isGenerating}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                        !topic || isGenerating
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                            : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/25'
                    }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} /> Writing Script...
                        </>
                    ) : (
                        <>
                            <Wand2 size={20} /> Generate Script
                        </>
                    )}
                </button>
            </div>
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-8 flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <AlignLeft size={16} /> Result
                </div>
                
                {generatedScript && (
                    <div className="flex gap-3">
                         <button 
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                        >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy Text'}
                        </button>
                    </div>
                )}
            </div>

            <textarea 
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                className="flex-1 w-full bg-[#0B0F15] p-6 text-slate-200 font-mono text-sm leading-relaxed outline-none resize-none focus:bg-black/20 transition-colors"
                placeholder={isGenerating ? "AI is thinking..." : "Your generated script will appear here. You can edit it before sending to the studio."}
            />

            {generatedScript && (
                 <div className="p-4 border-t border-slate-800 bg-slate-950/80 backdrop-blur absolute bottom-0 left-0 right-0 flex justify-end">
                    <button
                        onClick={() => onUseScript(generatedScript, niche)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        Use This Script <ChevronRight size={18} />
                    </button>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ScriptGeneratorTool;