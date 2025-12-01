import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene, VideoConfig, Niche, SafetyMode, ImageAspect } from "../types";
import { pcmToBase64Wav, base64ToBytes, createWavUrlFromPcmBytes } from "./audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper for rate limits
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 5, delay = 5000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Check for various 429/Resource Exhausted error formats
    const errorString = JSON.stringify(error);
    const isRateLimit = 
      error?.status === 429 || 
      error?.code === 429 || 
      error?.error?.code === 429 ||
      error?.response?.status === 429 ||
      errorString.includes('429') ||
      errorString.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('429') ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      error?.statusText?.includes('Too Many Requests');

    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limited. Retrying in ${delay}ms... (${retries} left)`);
      await wait(delay);
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Helper for Safety Settings
const getSafetySettings = (mode: SafetyMode) => {
    // Map SafetyMode to Gemini API thresholds
    // Strict -> BLOCK_LOW_AND_ABOVE
    // Normal -> BLOCK_MEDIUM_AND_ABOVE
    // Relaxed -> BLOCK_ONLY_HIGH
    
    const threshold = mode === SafetyMode.Relaxed ? 'BLOCK_ONLY_HIGH' : 
                      mode === SafetyMode.Strict ? 'BLOCK_LOW_AND_ABOVE' : 
                      'BLOCK_MEDIUM_AND_ABOVE';
    
    return [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold },
    ];
};

// 1. SCRIPT ANALYSIS & SEGMENTATION
export const analyzeScript = async (config: VideoConfig): Promise<{ scenes: Scene[], detectedNiche: string }> => {
  return retryWithBackoff(async () => {
    let nichePrompt = config.niche === Niche.Auto 
      ? "Analyze the text to determine the best fit niche (e.g., War, Kids, Meditation, Horror, etc)." 
      : `The target niche is ${config.niche}.`;

    const safetyInstruction = config.safetyMode === SafetyMode.Strict 
      ? "Ensure all visual prompts are strictly safe for all ages. No violence, gore, or frightening elements."
      : config.safetyMode === SafetyMode.Relaxed 
        ? "Allow for more mature themes if present in the script, but avoid explicit prohibition violations."
        : "Avoid graphic violence and explicit content.";

    const characterInstruction = config.characterConsistency
      ? `IMPORTANT - CHARACTER CONSISTENCY: The following details must be included in every relevant scene's visual prompt to ensure consistency: "${config.characterConsistency}". Start prompts with these character details where applicable.`
      : "Ensure visual consistency across scenes.";

    const systemInstruction = `
      You are an expert video director and storyboard artist. 
      Your task is to split a script into visual scenes.
      ${nichePrompt}
      ${safetyInstruction}
      ${characterInstruction}
      
      For the Visual Style, use: ${config.visualStyle}.
      For the Aspect Ratio, frame the shot for: ${config.imageAspect}.
      
      For each scene:
      1. Extract the spoken text.
      2. Create a HIGHLY detailed image generation prompt. The prompt must describe the subject, lighting, camera angle, art style, and mood. It must be self-contained.
      3. Estimate the duration in seconds based on reading speed.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        detectedNiche: { type: Type.STRING, description: "The detected or confirmed niche of the video." },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scriptText: { type: Type.STRING, description: "The exact text to be spoken." },
              visualPrompt: { type: Type.STRING, description: "A detailed prompt for an image generator." },
              estimatedDuration: { type: Type.NUMBER, description: "Duration in seconds." }
            },
            required: ["scriptText", "visualPrompt", "estimatedDuration"]
          }
        }
      },
      required: ["detectedNiche", "scenes"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [{ text: config.scriptText }]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        safetySettings: getSafetySettings(config.safetyMode)
      }
    });

    // Check for Prompt Feedback Block (Pre-generation block)
    if (response.promptFeedback?.blockReason) {
         throw new Error(`Content blocked by safety filters: ${response.promptFeedback.blockReason}. Try adjusting the Safety Mode to 'Relaxed' or modifying your script.`);
    }

    // Check for Candidate Safety Block (Post-generation block)
    if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
        throw new Error(`Analysis blocked by AI safety filters. Reason: ${response.candidates[0].finishReason}`);
    }

    let text = response.text;
    if (!text) {
        // Fallback attempt to get text from parts
        text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
             console.error("Empty Response Debug:", JSON.stringify(response, null, 2));
             throw new Error("Model returned empty response. Your script might be too short or violate safety policies.");
        }
    }
    
    // Sanitize markdown code blocks if present (e.g. ```json ... ```)
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON:", text);
        throw new Error("Failed to parse JSON response from model.");
    }
    
    // Validate structure
    if (!json.scenes || !Array.isArray(json.scenes)) {
         // Fallback: Check if the root itself is the scenes array
         if (Array.isArray(json)) {
             return {
                 detectedNiche: config.niche,
                 scenes: json.map((s: any, i: number) => ({
                    id: `scene-${Date.now()}-${i}`,
                    sequence: i,
                    scriptText: s.scriptText || '',
                    visualPrompt: s.visualPrompt || '',
                    estimatedDuration: s.estimatedDuration || 5,
                    status: 'pending'
                 }))
             };
         }
         console.error("Invalid JSON structure:", json);
         throw new Error("Invalid response format: 'scenes' array missing.");
    }
    
    return {
      detectedNiche: json.detectedNiche || config.niche,
      scenes: json.scenes.map((s: any, i: number) => ({
        id: `scene-${Date.now()}-${i}`,
        sequence: i,
        scriptText: s.scriptText,
        visualPrompt: s.visualPrompt,
        estimatedDuration: s.estimatedDuration,
        status: 'pending'
      }))
    };
  });
};

// 1.5 STORY SCENE BREAKDOWN (For Image Tool)
export const generateStoryScenePrompts = async (script: string, style: string, charConsistency: string): Promise<string[]> => {
    return retryWithBackoff(async () => {
        const systemInstruction = `
          You are a Scene-by-Scene Image Generator AI.
          
          TASK:
          1. Break the story into clear, distinct SCENES.
          2. Generate exactly ONE detailed image prompt per scene.
          3. Every image prompt MUST explicitly include the character descriptions provided below to ensure consistency.
          
          STRICT RULES:
          - Keep character appearance 100% consistent across all scenes.
          - Keep art style (${style}) 100% identical in every scene.
          - Output ONLY a simple JSON array of strings (the prompts).
          
          CHARACTERS (INCLUDE IN EVERY PROMPT):
          ${charConsistency || "No specific character details provided. Infer consistent characters from script and reuse their description in every prompt."}

          OUTPUT FORMAT:
          ["Scene 1 prompt with character details...", "Scene 2 prompt with character details..."]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                role: 'user',
                parts: [{ text: script }]
            },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                ],
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        if (response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked by safety filters: ${response.promptFeedback.blockReason}`);
        }

        if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
            throw new Error(`Generation blocked by AI safety filters. Reason: ${response.candidates[0].finishReason}`);
        }

        let text = response.text || '[]';
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse story prompts:", text);
            return [];
        }

        return Array.isArray(json) ? json : [];
    });
};

// 1.6 SCRIPT GENERATION TOOL
export const generateCreativeScript = async (topic: string, niche: string, duration: number): Promise<string> => {
    return retryWithBackoff(async () => {
        const approxWords = Math.ceil(duration * 150); // ~150 words per minute average reading speed
        
        const systemInstruction = `
            You are a professional screenwriter for viral videos and documentaries.
            
            TASK:
            Write a complete, engaging video script based on the user's topic.
            
            PARAMETERS:
            - Topic: "${topic}"
            - Target Niche: ${niche}
            - Target Duration: ${duration} minutes (approx. ${approxWords} words)
            
            FORMATTING RULES:
            - Do NOT include camera directions like "Cut to", "Fade in" inside the dialogue.
            - Write primarily the spoken narration/dialogue.
            - You can include short [Visual Notes] in brackets, but keep the focus on the spoken text.
            - Ensure the tone matches the ${niche} niche (e.g. Dramatic for War, Soothing for Meditation).
            - The output should be ready to paste into a Text-to-Speech engine.
            
            OUTPUT:
            Return ONLY the script text.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                role: 'user',
                parts: [{ text: `Write a script about: ${topic}` }]
            },
            config: {
                systemInstruction: systemInstruction,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                ]
            }
        });

        if (response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked by safety filters: ${response.promptFeedback.blockReason}`);
        }

        return response.text || "Failed to generate script.";
    });
};


// 2. GENERIC IMAGE GENERATION
export const generateImage = async (prompt: string, aspectRatio: ImageAspect): Promise<string> => {
  return retryWithBackoff(async () => {
    const finalPrompt = `Generate an image of: ${prompt}. Do not respond with text.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: finalPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        }
      });

      if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
         const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
         throw new Error(textPart || `Generation blocked by safety settings (${response.candidates[0].finishReason})`);
      }

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
            }
        }
      }
      
      const textResponse = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
      if (textResponse) {
          throw new Error(`Model returned text instead of image: "${textResponse.slice(0, 100)}..."`);
      }

      throw new Error("No image data found in response");
    } catch (error) {
      console.error("Image generation failed:", error);
      throw error;
    }
  });
};

export const generateSceneImage = async (scene: Scene, config: VideoConfig): Promise<string> => {
  return generateImage(scene.visualPrompt, config.imageAspect);
};

// 3. SPEECH GENERATION (Robust Chunking)
const MAX_TTS_CHARS = 3000; 

const splitTextIntoChunks = (text: string, limit: number): string[] => {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > limit) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
};

export const generateSpeech = async (
    text: string, 
    voiceName: string, 
    onProgress?: (completed: number, total: number) => void
): Promise<string> => {
    
  const chunks = splitTextIntoChunks(text, MAX_TTS_CHARS);
  const pcmChunks: Uint8Array[] = [];
  
  if (onProgress) onProgress(0, chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    await retryWithBackoff(async () => {
       const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         pcmChunks.push(base64ToBytes(base64Audio));
      } else {
        throw new Error("No audio content in response");
      }
    });
    
    if (onProgress) onProgress(i + 1, chunks.length);
    if (chunks.length > 5) await wait(1000);
  }

  if (pcmChunks.length === 0) throw new Error("Failed to generate audio chunks");

  const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combinedPcm = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    combinedPcm.set(chunk, offset);
    offset += chunk.length;
  }

  return createWavUrlFromPcmBytes(combinedPcm);
};

export const generateSceneAudio = async (scene: Scene, config: VideoConfig): Promise<string> => {
  return generateSpeech(scene.scriptText, config.voiceProfile.name);
};