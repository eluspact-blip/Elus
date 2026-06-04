import React from 'react';
import { Play, Type, Image as ImageIcon, Sparkles, Monitor, Smartphone, Square } from 'lucide-react';
import { AppState, VOICES, ASPECT_RATIOS, ANIMATION_PRESETS } from '../types';

interface SettingsPanelProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onGenerate: () => void;
}

export function SettingsPanel({ state, updateState, onGenerate }: SettingsPanelProps) {
  
  return (
    <div className="w-[480px] h-screen overflow-y-auto bg-bg-card flex flex-col shrink-0 custom-scrollbar">
      
      <div className="p-6 border-b border-bg-surface flex items-center gap-3 shrink-0 sticky top-0 bg-bg-card z-10 backdrop-blur-md bg-opacity-90">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
          <Type size={20} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight">Kinetix Studio</h1>
          <p className="text-xs text-neutral-400 font-medium tracking-wide border border-transparent">AI Kinetic Editor</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-8">
        
        {/* Script Input */}
        <section className="space-y-3">
          <label className="text-sm font-semibold tracking-wide text-neutral-300 uppercase flex items-center gap-2">
            1. Paste Script
          </label>
          <div className="relative group">
            <textarea
              value={state.script}
              onChange={(e) => updateState({ script: e.target.value })}
              placeholder="Enter the spoken text here. Our AI will break it down into scenes and select the perfect kinetic typography animations..."
              className="w-full h-40 bg-bg-surface text-white placeholder-neutral-500 rounded-2xl p-5 resize-none outline-none border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm leading-relaxed"
            />
            <div className="absolute bottom-4 right-4 text-xs font-mono text-neutral-500">
              {state.script.length} chars
            </div>
          </div>
        </section>

        {/* Voice Selection */}
        <section className="space-y-3">
          <label className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
            2. Select Voice
          </label>
          <div className="grid grid-cols-2 gap-3">
            {VOICES.map(voice => (
              <button
                key={voice.id}
                onClick={() => updateState({ voice: voice.id })}
                className={`flex items-center p-3 rounded-xl border text-sm transition-all ${
                  state.voice === voice.id 
                    ? 'border-primary bg-primary/10 text-white' 
                    : 'border-bg-surface bg-bg-surface text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-3 ${state.voice === voice.id ? 'bg-primary' : 'bg-neutral-600'}`} />
                <span className="truncate">{voice.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Visual Style & Tone */}
        <section className="space-y-3">
          <label className="text-sm font-semibold tracking-wide text-neutral-300 uppercase flex justify-between items-center">
            <span>3. Visual Style & Tone</span>
          </label>
          
          <input
            type="text"
            value={state.visualStyle}
            onChange={(e) => updateState({ visualStyle: e.target.value })}
            placeholder="e.g. Minimalist, intense, corporate, playful, neon glitch..."
            className="w-full bg-bg-surface text-white placeholder-neutral-500 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            {ANIMATION_PRESETS.map(preset => (
              <button
                 key={preset.id}
                 onClick={() => updateState({ visualStyle: preset.name })}
                 className={`relative overflow-hidden rounded-xl border transition-all text-left group aspect-video ${state.visualStyle === preset.name ? 'border-primary ring-2 ring-primary/20' : 'border-bg-surface hover:border-neutral-500'}`}
              >
                <img src={(preset as any).thumb} alt={preset.name} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className={`text-xs font-semibold drop-shadow-md ${state.visualStyle === preset.name ? 'text-primary' : 'text-white'}`}>
                    {preset.name}
                  </span>
                  {state.visualStyle === preset.name && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#ff5a00]" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Aspect Ratio */}
        <section className="space-y-3">
          <label className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
            Aspect Ratio
          </label>
          <div className="flex gap-3">
            {ASPECT_RATIOS.map(ratio => {
              const Icon = ratio.icon === 'Monitor' ? Monitor : ratio.icon === 'Smartphone' ? Smartphone : Square;
              return (
                <button
                  key={ratio.id}
                  onClick={() => updateState({ aspectRatio: ratio.id as any })}
                  className={`flex-1 p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    state.aspectRatio === ratio.id 
                      ? 'border-primary bg-primary/10 text-white' 
                      : 'border-bg-surface bg-bg-surface text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  <Icon size={20} className={state.aspectRatio === ratio.id ? 'text-primary' : ''} />
                  <span className="text-xs font-medium">{ratio.label}</span>
                </button>
              )
            })}
          </div>
        </section>
        
        {/* Reference Image (Mock) */}
        <section className="space-y-3">
          <label className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
            Reference Images (Optional)
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-bg-surface rounded-2xl hover:border-neutral-500 hover:bg-bg-surface/50 transition-all cursor-pointer group">
              <ImageIcon size={24} className="text-neutral-500 group-hover:text-primary mb-2 transition-colors" />
              <span className="text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors">
                Click or drag to upload reference images
              </span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => {
                if (e.target.files) {
                  const files = Array.from(e.target.files) as File[];
                  Promise.all(files.map(file => {
                      return new Promise<string>((resolve) => {
                       const reader = new FileReader();
                       reader.onload = (e) => {
                         const img = new Image();
                         img.onload = () => {
                           const canvas = document.createElement('canvas');
                           const maxSize = 800; // max width/height to save payload size
                           let width = img.width;
                           let height = img.height;
                           if (width > height) {
                             if (width > maxSize) {
                               height *= maxSize / width;
                               width = maxSize;
                             }
                           } else {
                             if (height > maxSize) {
                               width *= maxSize / height;
                               height = maxSize;
                             }
                           }
                           canvas.width = width;
                           canvas.height = height;
                           const ctx = canvas.getContext('2d');
                           ctx?.drawImage(img, 0, 0, width, height);
                           resolve(canvas.toDataURL('image/jpeg', 0.8));
                         };
                         img.src = e.target?.result as string;
                       };
                       reader.readAsDataURL(file);
                     });
                  })).then(images => {
                     updateState({ referenceImage: [...(state.referenceImage || []), ...images] });
                  });
                }
              }}/>
            </label>
            {state.referenceImage && state.referenceImage.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {state.referenceImage.map((img, i) => (
                   <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-bg-surface">
                     <img src={img} className="w-full h-full object-cover" />
                     <button onClick={(e) => { e.preventDefault(); updateState({ referenceImage: state.referenceImage!.filter((_, idx) => idx !== i) })}} className="absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center text-xs text-white hover:bg-red-500">×</button>
                   </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>

      <div className="p-6 mt-auto border-t border-bg-surface shrink-0 sticky bottom-0 bg-bg-card z-10 backdrop-blur-md bg-opacity-90">
        <button
          onClick={onGenerate}
          disabled={!state.script.trim() || state.status === 'analyzing' || state.status === 'generating'}
          className="w-full bg-primary hover:bg-primary-dark disabled:bg-bg-surface disabled:text-neutral-500 text-white font-medium py-4 rounded-xl shadow-[0_0_40px_rgba(255,90,0,0.3)] transition-all flex items-center justify-center gap-2 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <Sparkles size={18} className="relative z-10" />
          <span className="relative z-10">Generate Editor Timeline</span>
        </button>
      </div>

    </div>
  );
}
