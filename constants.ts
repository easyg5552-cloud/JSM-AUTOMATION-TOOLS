import { Niche, VisualStyle, ImageAspect, VoiceProfile, SafetyMode, TransitionType } from './types';

export const VOICE_PROFILES: VoiceProfile[] = [
  { name: 'Puck', gender: 'male', style: 'Playful, Clear' },
  { name: 'Kore', gender: 'female', style: 'Calm, Soothing' },
  { name: 'Fenrir', gender: 'male', style: 'Deep, Dramatic' },
  { name: 'Charon', gender: 'male', style: 'Authoritative, Deep' },
  { name: 'Zephyr', gender: 'female', style: 'Friendly, Neutral' },
];

export const DEFAULT_CONFIG = {
  scriptText: "In the heart of a dense, bioluminescent forest, a small robot named Unit 734 awakens. Moss covers its metallic joints, suggesting it has been asleep for centuries. It looks up to see giant mushrooms glowing with soft blue light. A digital chirp escapes its speaker, echoing through the silent woods.",
  characterConsistency: "",
  niche: Niche.Auto,
  targetDurationMinutes: 1,
  voiceProfile: VOICE_PROFILES[0],
  visualStyle: VisualStyle.Cinematic,
  imageAspect: ImageAspect.SixteenNine,
  safetyMode: SafetyMode.Normal,
  transitionType: TransitionType.Fade,
  referenceImage: null,
};

export const NICHE_OPTIONS = Object.values(Niche);
export const STYLE_OPTIONS = Object.values(VisualStyle);
export const ASPECT_OPTIONS = Object.values(ImageAspect);
export const SAFETY_OPTIONS = Object.values(SafetyMode);
export const TRANSITION_OPTIONS = Object.values(TransitionType);