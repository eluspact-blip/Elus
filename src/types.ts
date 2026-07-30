export interface AppState {
  script: string;
  voice: string;
  visualStyle: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  referenceImage: string[] | null;
  assetImages: { url: string; description: string }[] | null;
  assetLinks: { url: string; description: string }[] | null;
  status: 'idle' | 'analyzing' | 'generating' | 'ready';
  scenes: Scene[];
}

export interface Scene {
  id: string;
  text: string;
  duration: number;
  animationType: 'fade' | 'slide-up' | 'scale' | 'typewriter' | 'blur-in';
  keywordStyle?: 'highlight' | 'bounce' | 'split';
  keywords: string[];
  layout: 'text-only' | 'counter' | 'phone' | 'image-card' | 'browser' | 'tabs' | 'button-click' | 'search-bar' | 'profile-card' | 'code-editor' | 'custom-html';
  layoutData?: any;
  customHtml?: string;
  themeConfig?: {
    backgroundColor: string;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    cardColor: string;
    borderRadius: string;
  };
}

export const VOICES = [
  { id: 'v1', name: 'Atlas (Deep, Cinematic)' },
  { id: 'v2', name: 'Nova (Energetic, Clear)' },
  { id: 'v3', name: 'Echo (Calm, Informative)' },
  { id: 'v4', name: 'Orbit (Playful, Upbeat)' },
];

export const ASPECT_RATIOS = [
  { id: '16:9', label: 'Wide (16:9)', icon: 'Monitor' },
  { id: '9:16', label: 'Vertical (9:16)', icon: 'Smartphone' },
  { id: '1:1', label: 'Square (1:1)', icon: 'Square' },
];

export const ANIMATION_PRESETS = [
  { id: 'minimal', name: 'Minimalist', thumb: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=300&q=80' },
  { id: 'dynamic', name: 'Motion UI', thumb: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&q=80' },
  { id: 'glitch', name: 'Dark Dashboard', thumb: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=300&q=80' },
  { id: 'elegant', name: 'App Screens', thumb: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=300&q=80' },
];
