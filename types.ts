export enum Niche {
  Auto = 'auto',
  War = 'war',
  Motivational = 'motivational',
  Meditation = 'meditation',
  Kids = 'kids',
  Horror = 'horror',
  Love = 'love',
  History = 'history',
  Fantasy = 'fantasy',
  Islamic = 'islamic'
}

export enum VisualStyle {
  Photorealistic = 'photorealistic',
  Cinematic = 'cinematic',
  Cartoon = 'cartoon',
  Watercolor = 'watercolor',
  Anime = 'anime',
  Documentary = 'documentary',
  Fantasy = 'fantasy',
  Minimal = 'minimal'
}

export enum ImageAspect {
  SixteenNine = '16:9',
  NineSixteen = '9:16',
  OneOne = '1:1'
}

export enum SafetyMode {
  Strict = 'strict',
  Normal = 'normal',
  Relaxed = 'relaxed'
}

export enum TransitionType {
  None = 'none',
  Fade = 'fade',
  Dissolve = 'dissolve',
  Wipe = 'wipe'
}

export enum ExportFormat {
  Video720p = 'video_720p',
  Video1080p = 'video_1080p',
  Video2K = 'video_2k',
  Video4K = 'video_4k',
  AudioOnly = 'audio_only'
}

export interface VoiceProfile {
  name: string; // e.g., 'Puck', 'Kore', 'Fenrir'
  gender: 'male' | 'female';
  style: string;
}

export interface VideoConfig {
  scriptText: string;
  characterConsistency?: string; // New field for consistency notes
  niche: Niche;
  targetDurationMinutes: number;
  voiceProfile: VoiceProfile;
  visualStyle: VisualStyle;
  imageAspect: ImageAspect;
  safetyMode: SafetyMode;
  transitionType: TransitionType;
  referenceImage?: string | null; // Base64 string for reference style
}

export interface Scene {
  id: string;
  sequence: number;
  scriptText: string;
  visualPrompt: string;
  estimatedDuration: number;
  manualDuration?: number; // User override
  imageUrl?: string; // Object URL or Base64
  audioUrl?: string; // Object URL (WAV)
  audioDuration?: number;
  status: 'pending' | 'generating_image' | 'generating_audio' | 'ready' | 'error';
  error?: string;
}

export interface GenerationState {
  status: 'idle' | 'analyzing' | 'generating_assets' | 'ready';
  progress: number; // 0-100
  currentStep: string;
}