import React, { useState } from 'react';
import { AppState, Scene } from './types';
import { SettingsPanel } from './components/SettingsPanel';
import { CanvasPreview } from './components/CanvasPreview';

export default function App() {
  const [state, setState] = useState<AppState>({
    script: '',
    voice: 'v1',
    visualStyle: '',
    aspectRatio: '16:9',
    referenceImage: null,
    status: 'idle',
    scenes: []
  });

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleGenerate = async () => {
    if (!state.script.trim()) return;

    updateState({ status: 'analyzing' });

    try {
      const res = await fetch('/api/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: state.script,
          visualStyle: state.visualStyle,
          aspectRatio: state.aspectRatio,
          referenceImages: state.referenceImage
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'API failed');
      }
      const data = await res.json();
      
      let imageIdx = 0;
      const finalScenes = data.scenes.map((scene: Scene) => {
         // Keep the fallback insertion just in case it uses old layouts
         if (state.referenceImage && state.referenceImage.length > 0) {
            if (['image-card', 'profile-card', 'browser', 'phone'].includes(scene.layout) && !scene.layoutData?.url) {
               const url = state.referenceImage[imageIdx % state.referenceImage.length];
               imageIdx++;
               return { ...scene, layoutData: { ...scene.layoutData, url } };
            }
         }
         return scene;
      });

      updateState({ status: 'ready', scenes: finalScenes });
    } catch (err: any) {
      console.error("Generator failed", err);
      updateState({ status: 'idle' });
      
      let errMsg = err.message;
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
         errMsg = "The AI model is currently busy. Please wait a few moments and try again.";
      } else if (errMsg.includes('cut off') || errMsg.includes('large and got cut off') || errMsg.includes('Unterminated')) {
         errMsg = "The generated scenes were too complex and the AI's response was truncated. Please try a shorter script.";
      }
      
      alert(`Failed to generate animation over API: ${errMsg}`);
    }
  };

  const handleReset = () => {
    updateState({ status: 'idle', scenes: [] });
  };

  return (
    <div className="flex h-screen w-full bg-bg-dark text-white overflow-hidden selection:bg-primary/30">
      
      {/* Left Settings Panel */}
      <SettingsPanel 
        state={state} 
        updateState={updateState} 
        onGenerate={handleGenerate}
      />
      
      {/* Right Canvas / Preview Area */}
      <CanvasPreview 
        state={state}
        onReset={handleReset}
      />
      
    </div>
  );
}

