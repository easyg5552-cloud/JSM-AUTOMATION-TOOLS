import React, { useState, useEffect, useRef } from 'react';
import { ImageAspect, VisualStyle } from '../types';
import { ASPECT_OPTIONS, STYLE_OPTIONS } from '../constants';
import { generateImage, generateStoryScenePrompts } from '../services/geminiService';
import { Download, Loader2, Image as ImageIcon, Wand2, Trash2, LayoutGrid, XCircle, Infinity, Square, BookOpen, Layers, RefreshCw } from 'lucide-react';

interface Props {
    onBack: () => void;
}

interface GeneratedImage {
    id: string;
    url: string;
    status: 'loading' | 'success' | 'error';
    label?: string; // e.g. "Scene 1"
    prompt?: string; // Stored prompt for regeneration
}

const BulkImageGenerator: React.FC<Props> = ({ onBack }) => {
    // Mode State
    const [mode, setMode] = useState<'free' | 'story'>('free');

    // Input State
    const [prompt, setPrompt] = useState('');
    const [consistencyPrompt, setConsistencyPrompt] = useState(''); // For Story Mode
    const [aspect, setAspect] = useState<ImageAspect>(ImageAspect.SixteenNine);
    const [style, setStyle] = useState<VisualStyle>(VisualStyle.Cinematic);
    
    // Execution State
    const [activeRequests, setActiveRequests] = useState(0);
    const [results, setResults] = useState<GeneratedImage[]>([]);
    const [isAnalyzingStory, setIsAnalyzingStory] = useState(false);
    
    // Auto-Generation State
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Continuous Generation Loop (Only for Free Mode)
    useEffect(() => {
        if (isAutoGenerating && mode === 'free') {
            const checkAndGenerate = () => {
                if (activeRequests < 3 && prompt) {
                    triggerSingleGeneration();
                }
            };
            
            const interval = setInterval(checkAndGenerate, 6000); // 6s interval for rate safety
            timerRef.current = interval;

            return () => clearInterval(interval);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isAutoGenerating, activeRequests, prompt, mode]);

    // --- Free Mode Generation ---
    const triggerSingleGeneration = async () => {
        if (!prompt) return;
        
        const newId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setActiveRequests(prev => prev + 1);

        // Add subtle variation noise
        const variationSeeds = ['detailed', 'dynamic lighting', 'different angle', 'unique composition', 'vivid colors', 'moody atmosphere', 'sharp focus'];
        const randomSeed = variationSeeds[Math.floor(Math.random() * variationSeeds.length)];

        const enhancedPrompt = style === VisualStyle.Photorealistic 
            ? `${prompt} -- ${randomSeed}` 
            : `${prompt}. Art style: ${style}. ${randomSeed}. High quality, detailed.`;

        setResults(prev => [{ 
            id: newId, 
            url: '', 
            status: 'loading', 
            label: 'Variation', 
            prompt: enhancedPrompt 
        }, ...prev]);

        try {
            const url = await generateImage(enhancedPrompt, aspect);
            setResults(prev => prev.map(item => item.id === newId ? { ...item, url, status: 'success' } : item));
        } catch (e) {
            console.error(`Failed to generate image ${newId}`, e);
            setResults(prev => prev.map(item => item.id === newId ? { ...item, status: 'error' } : item));
        } finally {
            setActiveRequests(prev => prev - 1);
        }
    };

    // --- Story Mode Generation ---
    const triggerStoryGeneration = async () => {
        if (!prompt) return;
        
        setIsAnalyzingStory(true);
        setResults([]); // Clear previous for story mode

        try {
            // 1. Break down scenes
            let scenePrompts = await generateStoryScenePrompts(prompt, style, consistencyPrompt);
            
            // 1.5 Manually enforce consistency if provided (Redundancy Layer)
            // This ensures that even if the LLM analysis missed it, the final image generation prompt includes the rules.
            if (consistencyPrompt && consistencyPrompt.trim()) {
                scenePrompts = scenePrompts.map(p => {
                    return `${p}. \n[Visual Consistency Rules: ${consistencyPrompt.trim()}]`;
                });
            }

            setIsAnalyzingStory(false);

            // 2. Queue all scenes with their specific prompts
            const newItems: GeneratedImage[] = scenePrompts.map((p, i) => ({
                id: `scene-${Date.now()}-${i}`,
                url: '',
                status: 'loading',
                label: `Scene ${i + 1}`,
                prompt: p
            }));
            setResults(newItems);

            // 3. Generate one by one (or small batch)
            // We'll do them sequentially to be safe with rate limits.
            for (let i = 0; i < scenePrompts.length; i++) {
                const item = newItems[i];
                const p = scenePrompts[i];
                
                try {
                    const url = await generateImage(p, aspect);
                    setResults(prev => prev.map(r => r.id === item.id ? { ...r, url, status: 'success' } : r));
                } catch (e) {
                    setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error' } : r));
                }
                
                // 6-second delay between batch items to prevent 429 errors
                await new Promise(r => setTimeout(r, 6000));
            }

        } catch (error) {
            console.error("Story generation failed", error);
            setIsAnalyzingStory(false);
            alert("Failed to analyze story. Please try again.");
        }
    };

    const handleRegenerate = async (id: string) => {
        const item = results.find(r => r.id === id);
        if (!item || !item.prompt) return;

        // Reset status to loading
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'loading' } : r));

        try {
            const url = await generateImage(item.prompt, aspect);
            setResults(prev => prev.map(r => r.id === id ? { ...r, url, status: 'success' } : r));
        } catch (e) {
            console.error(`Regeneration failed for ${id}`, e);
            setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'error' } : r));
        }
    };

    const toggleAutoGenerate = () => {
        if (!prompt) return;
        setIsAutoGenerating(!isAutoGenerating);
    };

    const handleClear = () => {
        setPrompt('');
        setConsistencyPrompt('');
        setResults([]);
        setIsAutoGenerating(false);
    };

    const removeImage = (id: string) => {
        setResults(prev => prev.filter(item => item.id !== id));
    };

    const handleDownloadAll = async () => {
        const successfulImages = results.filter(r => r.status === 'success');
        if (successfulImages.length === 0) return;

        // Sequential download with delay to prevent browser blocking
        for (let i = 0; i < successfulImages.length; i++) {
            const img = successfulImages[i];
            const link = document.createElement('a');
            link.href = img.url;
            link.download = `vidgen_${mode}_${img.label || 'img'}_${i}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 500ms delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in h-full overflow-y-auto">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between sticky top-0 bg-[#0f172a] z-10 py-4 border-b border-slate-800/50">
                 <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-orange-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                        <LayoutGrid className="text-pink-500" /> Image Studio
                    </h1>
                    <p className="text-slate-400">Generate unlimited variations or create scene-by-scene storyboards.</p>
                 </div>
                 <button 
                    onClick={onBack} 
                    className="text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                >
                    Back to Studio
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Controls - Left Side */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl sticky top-32">
                        
                        {/* Mode Toggle */}
                        <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
                            <button 
                                onClick={() => setMode('free')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === 'free' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Infinity size={16} /> Free Mode
                            </button>
                            <button 
                                onClick={() => setMode('story')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === 'story' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <BookOpen size={16} /> Story Mode
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    {mode === 'story' ? 'Story Script' : 'Prompt'}
                                </label>
                                {results.length > 0 && (
                                    <button onClick={handleClear} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1">
                                        <Trash2 size={12} /> Clear All
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none scrollbar-thin text-sm leading-relaxed placeholder:text-slate-600"
                                placeholder={mode === 'story' ? "Paste your full story or script here..." : "Describe the image you want to generate..."}
                            />
                        </div>

                        {mode === 'story' && (
                            <div className="mb-6 animate-fade-in bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30 shadow-inner">
                                <label className="block text-sm font-bold text-indigo-300 mb-2 flex items-center gap-2">
                                    <Layers size={14} /> Character Consistency
                                </label>
                                <textarea
                                    value={consistencyPrompt}
                                    onChange={(e) => setConsistencyPrompt(e.target.value)}
                                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none scrollbar-thin text-xs leading-relaxed placeholder:text-slate-500"
                                    placeholder="Define persistent characters here. E.g. 'Boy: 5yo, red shirt. Girl: 6yo, blue dress.' These rules will be enforced in every scene."
                                />
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aspect Ratio</label>
                                     <select
                                        className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-indigo-500 outline-none text-sm appearance-none"
                                        value={aspect}
                                        onChange={(e) => setAspect(e.target.value as ImageAspect)}
                                      >
                                        {ASPECT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                      </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Style</label>
                                     <select
                                        className="w-full h-10 bg-slate-800 border border-slate-700 rounded-lg px-3 text-white focus:ring-indigo-500 outline-none text-sm appearance-none"
                                        value={style}
                                        onChange={(e) => setStyle(e.target.value as VisualStyle)}
                                      >
                                        {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                      </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {mode === 'free' ? (
                                <>
                                    <button
                                        onClick={triggerSingleGeneration}
                                        disabled={!prompt || isAutoGenerating}
                                        className={`w-full py-3 rounded-xl font-bold text-md shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                                            !prompt || isAutoGenerating
                                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                                        }`}
                                    >
                                        <Wand2 size={18} /> Generate Once
                                    </button>

                                    <button
                                        onClick={toggleAutoGenerate}
                                        disabled={!prompt}
                                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                                            !prompt
                                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                : isAutoGenerating
                                                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 animate-pulse'
                                                    : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-pink-500/25'
                                        }`}
                                    >
                                        {isAutoGenerating ? (
                                            <>
                                                <Square size={18} fill="currentColor" /> Stop Auto-Generate
                                            </>
                                        ) : (
                                            <>
                                                <Infinity size={22} /> Start Auto-Generate
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={triggerStoryGeneration}
                                    disabled={!prompt || isAnalyzingStory}
                                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                                        !prompt || isAnalyzingStory
                                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25'
                                    }`}
                                >
                                    {isAnalyzingStory ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} /> Analyzing Story...
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen size={20} /> Generate Storyboard
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        
                        {(activeRequests > 0 || isAutoGenerating || isAnalyzingStory) && (
                            <div className="mt-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="animate-spin text-indigo-500" size={12} />
                                        {isAnalyzingStory ? 'Breaking down scenes...' : 'Generating images...'}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results - Right Side */}
                <div className="lg:col-span-8">
                    {/* Results Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Generated Assets <span className="bg-slate-800 text-sm py-0.5 px-2 rounded-md text-slate-400">{results.length}</span>
                        </h2>
                        
                        {results.some(r => r.status === 'success') && (
                            <button 
                                onClick={handleDownloadAll}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                <Download size={16} /> Download All
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {results.map((res) => (
                            <div key={res.id} className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative group border border-slate-800 shadow-lg animate-fade-in">
                                {res.label && (
                                    <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase tracking-wider">
                                        {res.label}
                                    </div>
                                )}
                                
                                {res.status === 'success' ? (
                                    <>
                                        <img src={res.url} alt="Generated" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                            <div className="flex items-center gap-3 translate-y-4 group-hover:translate-y-0 transition-transform">
                                                <a 
                                                    href={res.url} 
                                                    download={`gen_image_${res.id}.png`} 
                                                    className="flex-1 py-2 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-xl"
                                                >
                                                    <Download size={18} /> Download
                                                </a>
                                                <button 
                                                    onClick={() => removeImage(res.id)}
                                                    className="p-2 bg-red-500/20 text-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : res.status === 'error' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-900/10 border-2 border-red-900/20 relative">
                                        <XCircle size={32} className="mb-2" />
                                        <span className="text-sm font-medium">Generation Failed</span>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleRegenerate(res.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                                            >
                                                <RefreshCw size={12} /> Retry
                                            </button>
                                            <button 
                                                onClick={() => removeImage(res.id)}
                                                className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-slate-900/50 animate-pulse"></div>
                                        <Loader2 className="animate-spin mb-3 text-indigo-500 relative z-10" size={32} />
                                        <span className="text-xs uppercase tracking-wider font-medium relative z-10">
                                            {mode === 'story' ? 'Visualizing Scene...' : 'Dreaming...'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {results.length === 0 && !isAutoGenerating && !isAnalyzingStory && (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                                <div className="p-6 bg-slate-800 rounded-full mb-4">
                                    <ImageIcon size={48} className="text-slate-500" />
                                </div>
                                <p className="text-xl font-medium text-slate-400">
                                    {mode === 'story' ? 'Storyboard Canvas' : 'Unlimited Gallery'}
                                </p>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm text-center">
                                    {mode === 'story' 
                                      ? "Paste your story script, define characters, and let AI generate a consistent scene-by-scene storyboard."
                                      : "Paste a prompt and start auto-generation to create an endless stream of unique variations."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkImageGenerator;