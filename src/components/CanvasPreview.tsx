import React from 'react';
import { Play, Loader2, Sparkles, Download, Check, MousePointer2, Pause } from 'lucide-react';
import { AppState, Scene } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface CanvasPreviewProps {
  state: AppState;
  onReset: () => void;
}

export function CanvasPreview({ state, onReset }: CanvasPreviewProps) {
  const isGenerating = state.status === 'analyzing' || state.status === 'generating';
  const isReady = state.status === 'ready';

  const [globalTime, setGlobalTime] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportComplete, setExportComplete] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const [seekKey, setSeekKey] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const exportRecorderRef = React.useRef<MediaRecorder | null>(null);

  const totalDuration = React.useMemo(() => {
    return state.scenes?.reduce((acc, s) => acc + Math.max(s.duration || 2000, 2000), 0) || 0;
  }, [state.scenes]);

  let calculatedScene = 0;
  let sceneProgress = 0;
  let cumTime = 0;
  if (state.scenes && state.scenes.length > 0) {
      for (let i = 0; i < state.scenes.length; i++) {
          const sDuration = Math.max(state.scenes[i].duration || 2000, 2000);
          if (globalTime >= cumTime && globalTime < cumTime + sDuration) {
              calculatedScene = i;
              sceneProgress = (globalTime - cumTime) / sDuration;
              break;
          }
          cumTime += sDuration;
      }
      if (globalTime >= totalDuration && state.scenes.length > 0) {
          calculatedScene = state.scenes.length - 1;
          sceneProgress = 1;
      }
  }

  const currentScene = calculatedScene;

  React.useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const targetW = state.aspectRatio === '16:9' ? 1280 : state.aspectRatio === '9:16' ? 720 : 900;
        const targetH = state.aspectRatio === '16:9' ? 720 : state.aspectRatio === '9:16' ? 1280 : 900;
        // padding of 40px all around
        const scaleX = (width) / targetW;
        const scaleY = (height) / targetH;
        setScale(Math.min(scaleX, scaleY));
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [state.aspectRatio]);

  const lastTimeRef = React.useRef<number | null>(null);
  const prevSceneRef = React.useRef<number>(-1);

  React.useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      window.speechSynthesis.cancel();
      prevSceneRef.current = -1;
      return;
    }

    let rafId: number;
    const update = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      setGlobalTime(prev => {
        const next = prev + dt;
        if (next >= totalDuration) {
            setIsPlaying(false);
            if (exportRecorderRef.current && exportRecorderRef.current.state === "recording") {
                exportRecorderRef.current.stop();
                exportRecorderRef.current = null;
            }
            return totalDuration;
        }
        return next;
      });
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, totalDuration]);

  React.useEffect(() => {
    if (isPlaying && state.scenes && state.scenes.length > 0) {
      if (calculatedScene !== prevSceneRef.current && globalTime < totalDuration) {
        window.speechSynthesis.cancel();
        const scene = state.scenes[calculatedScene];
        if (scene && scene.text) {
          const utterance = new SpeechSynthesisUtterance(scene.text);
          utterance.rate = 1.05;
          utterance.pitch = 0.95;
          window.speechSynthesis.speak(utterance);
        }
        prevSceneRef.current = calculatedScene;
      }
    }
  }, [calculatedScene, isPlaying, state.scenes, globalTime, totalDuration]);

  const togglePlay = () => {
    if (!isPlaying && globalTime >= totalDuration) {
      setGlobalTime(0);
    }
    setIsPlaying(!isPlaying);
  };


  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);
    window.speechSynthesis.cancel();
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      } as any);

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `kinetix-export-${state.aspectRatio.replace(':', 'x')}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        stream.getTracks().forEach(t => t.stop());
        
        setIsExporting(false);
        setExportComplete(true);
        setTimeout(() => setExportComplete(false), 3000);
      };

      exportRecorderRef.current = recorder;
      
      setGlobalTime(0);
      
      // We must start playback so our effect loops through scenes, talks, and changes state
      recorder.start(100);
      setTimeout(() => setIsPlaying(true), 500); // 500ms lead up
    } catch (err: any) {
      console.error(err);
      setIsExporting(false);
      alert('Screen recording blocked or denied. Please open the app in a New Tab (top right) or check your browser permissions. Error: ' + err.message);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTime = globalTime;

  return (
    <div className="flex-1 bg-[#0A0A0A] border-l border-bg-surface flex object-cover flex-col items-center justify-center p-4 md:p-10 h-screen overflow-hidden relative">
       
      <div className="w-full h-full max-w-[1280px] bg-black border border-neutral-800 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col relative overflow-hidden">
        
        {/* Main Canvas Area */}
        <div ref={containerRef} className="flex-1 p-0 flex items-center justify-center relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black rounded-t-2xl">
          {state.status === 'idle' && (
            <div className="flex flex-col items-center text-neutral-500 max-w-sm text-center">
               <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
                 <Sparkles size={24} className="text-neutral-600" />
               </div>
               <p className="font-medium text-white mb-2">Ready to Animate</p>
               <p className="text-sm">Configure your settings and hit generate to watch the AI create your video.</p>
            </div>
          )}

          {isGenerating && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center max-w-sm text-center bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-2xl relative z-10"
            >
               <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="mb-6 text-primary"
               >
                 <Loader2 size={32} />
               </motion.div>
               <h3 className="text-lg font-display font-bold mb-2 text-white">
                 {state.status === 'analyzing' ? 'Writing Script...' : 'Generating Video...'}
               </h3>
               <p className="text-sm text-neutral-400">
                 {state.status === 'analyzing' 
                    ? 'Breaking down the topic into visual scenes.'
                    : 'Applying motion and layout designs.'}
               </p>
            </motion.div>
          )}

          {isReady && state.scenes.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                 className="relative shadow-2xl overflow-hidden flex items-center justify-center shrink-0 pointer-events-auto transition-colors duration-700 rounded-sm"
                 style={{ 
                   width: state.aspectRatio === '16:9' ? 1280 : state.aspectRatio === '9:16' ? 720 : 900,
                   height: state.aspectRatio === '16:9' ? 720 : state.aspectRatio === '9:16' ? 1280 : 900,
                   transform: `scale(${scale})`,
                   transformOrigin: 'center',
                   backgroundColor: state.scenes[currentScene]?.themeConfig?.backgroundColor || '#000000',
                   // border width omitted to create a clean video frame
                 }}
              >
                
                <AnimatePresence mode="wait">
                  {state.scenes[currentScene] && (
                    <KineticScene key={`${currentScene}-${seekKey}`} scene={state.scenes[currentScene]} fastRender={isExporting} aspectRatio={state.aspectRatio} />
                  )}
                </AnimatePresence>

                {!isPlaying && !isExporting && sceneProgress === 0 && currentScene === 0 && (
                  <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 cursor-pointer"
                     onClick={togglePlay}
                  >
                     <button className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-md">
                       <Play size={40} fill="white" className="ml-2 text-white" />
                     </button>
                  </motion.div>
                )}
                
                {!isPlaying && !isExporting && (sceneProgress > 0 || currentScene > 0) && (
                   // Paused State
                   <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 z-10 cursor-pointer"
                     onClick={togglePlay}
                   >
                     <button className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-md text-white">
                       <Play size={40} fill="white" className="ml-2" />
                     </button>
                   </motion.div>
                )}

                {isExporting && (
                   <div className="absolute top-8 left-8 flex items-center gap-3 bg-red-600/90 py-2 px-4 rounded-full shadow-lg z-50 text-white animate-pulse font-medium">
                     <div className="w-3 h-3 bg-white rounded-full"></div> Recording: Scene {currentScene + 1}/{state.scenes.length}
                   </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Video Player Controls Bar */}
        {isReady && state.scenes.length > 0 && (
          <div className="bg-neutral-900 border-t border-neutral-800 p-4 transition-all shrink-0">
             {/* Scrubber / Progress Bar */}
             <div className="w-full h-2 bg-neutral-800 rounded-full mb-4 relative group cursor-pointer">
                <input
                    type="range"
                    min="0"
                    max={totalDuration}
                    step="10"
                    value={globalTime}
                    onPointerDown={() => isPlaying && setIsPlaying(false)}
                    onPointerUp={() => setSeekKey(prev => prev + 1)}
                    onChange={(e) => {
                       setGlobalTime(parseFloat(e.target.value));
                       prevSceneRef.current = -1;
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                   className="absolute top-0 bottom-0 left-0 bg-primary transition-none rounded-full group-hover:bg-primary" 
                   style={{ width: totalDuration ? `${(globalTime / totalDuration) * 100}%` : '0%' }} 
                />
                <div 
                   className="absolute top-1/2 -mt-2 w-4 h-4 bg-white rounded-full pointer-events-none opacity-0 group-hover:opacity-100 shadow-md transition-opacity"
                   style={{ left: totalDuration ? `calc(${(globalTime / totalDuration) * 100}% - 8px)` : '0px' }}
                />
             </div>
             
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-5">
                 <button 
                   onClick={togglePlay}
                   disabled={isExporting}
                   className="flex items-center justify-center text-white hover:text-primary transition-transform active:scale-95 disabled:scale-100 disabled:opacity-50"
                 >
                   {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                 </button>
                 
                 <div className="text-neutral-400 font-mono text-sm tracking-widest">
                   <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(totalDuration)}
                 </div>
               </div>

               <div className="flex items-center gap-4">
                 <button
                    onClick={() => {
                        window.speechSynthesis.cancel();
                        onReset();
                    }}
                    className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                 >
                    Edit Prompt
                 </button>
                 <button 
                   onClick={handleExport}
                   disabled={isExporting}
                   className={`px-5 py-2 text-white font-medium text-sm rounded-full flex items-center gap-2 hover:opacity-90 transition-transform active:scale-95 ${exportComplete ? 'bg-green-600' : isExporting ? 'bg-red-600 animate-pulse' : 'bg-white text-black'}`}
                 >
                   {exportComplete ? <Check size={16} /> : <Download size={16} />}
                   {isExporting ? 'Recording...' : exportComplete ? 'Saved to Downloads!' : 'Export Video'}
                 </button>
               </div>
             </div>
          </div>
        )}

      </div>

      {isExporting && (
         <div className="absolute inset-0 z-50 pointer-events-none" style={{ backdropFilter: 'blur(2px)' }} />
      )}
    </div>
  );
}

// Sub-component for rendering the actual text animation
function KineticScene({ scene, fastRender, aspectRatio }: { scene: Scene, key?: React.Key, fastRender?: boolean, aspectRatio?: string }) {
  
  if (scene.layout === 'custom-html' && scene.customHtml) {
    return <CustomHtmlLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'counter' && scene.layoutData) {
    return <CounterLayout scene={scene} start={scene.layoutData.start} end={scene.layoutData.end} prefix={scene.layoutData.prefix} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'phone') {
    return <PhoneLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'image-card' && scene.layoutData) {
    return <ImageCardLayout scene={scene} url={scene.layoutData.url} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'browser') {
    return <BrowserLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'tabs') {
    return <TabSwitchLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'button-click') {
    return <ButtonInteractLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'search-bar') {
    return <SearchBarLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'profile-card') {
    const url = scene.layoutData?.url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    return <ProfileCardLayout scene={scene} url={url} fastRender={fastRender} aspectRatio={aspectRatio} />
  } else if (scene.layout === 'code-editor') {
    return <CodeEditorLayout scene={scene} fastRender={fastRender} aspectRatio={aspectRatio} />
  }

  const theme = scene.themeConfig || {
    backgroundColor: '#000000', primaryColor: '#FF5A00', secondaryColor: '#262626', textColor: '#FFFFFF', cardColor: '#171717', borderRadius: '1rem'
  };

  // Render words, applying highlight to keywords for 'text-only' layout
  const words = scene.text.split(' ');
  const wordCount = words.length;
  let textSizeClass = aspectRatio === '9:16' ? 'text-3xl' : 'text-5xl lg:text-7xl';
  if (wordCount > 15) {
      textSizeClass = aspectRatio === '9:16' ? 'text-2xl' : 'text-4xl lg:text-5xl';
  } else if (wordCount > 10) {
      textSizeClass = aspectRatio === '9:16' ? 'text-2xl' : 'text-4xl lg:text-6xl';
  }

  const sceneDurationSecondary = Math.max(scene.duration || 2000, 2000) / 1000; // in seconds
  // Ensure the whole stagger animation finishes at least 0.5s before the scene ends
  const maxStaggerTotal = Math.max(sceneDurationSecondary - 1.0, 0.5); 
  const calculatedStagger = wordCount > 0 ? (maxStaggerTotal / wordCount) : 0.1;
  const staggerTime = fastRender ? 0.05 : Math.min(calculatedStagger, 0.1); // cap at 0.1 for short scenes
  const wordTransitionDuration = fastRender ? 0.2 : 0.6;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: staggerTime,
        ease: "easeOut",
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      transition: { duration: fastRender ? 0.2 : 0.4, ease: "easeIn" }
    }
  };

  const wordVariants = {
    hidden: { 
      opacity: 0, 
      y: scene.animationType === 'slide-up' ? 20 : 0,
      scale: scene.animationType === 'scale' ? 0.8 : 1,
      filter: scene.animationType === 'blur-in' ? 'blur(10px)' : 'blur(0px)',
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: wordTransitionDuration, ease: [0.25, 0.1, 0.25, 1] } // Smooth easing
    } 
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="text-center w-full px-6 flex items-center justify-center overflow-visible"
    >
      <h1 
        className={`font-display font-bold leading-tight tracking-tight flex flex-wrap justify-center overflow-visible gap-[0.3em] ${textSizeClass}`}
        style={{ color: theme.textColor }}
      >
        {words.map((word, i) => {
          const isKeyword = scene.keywords.some(k => word.toLowerCase().includes(k.toLowerCase()));
          return (
            <motion.span 
              key={i} 
              variants={wordVariants}
              className={`inline-block py-1`}
              style={isKeyword ? { color: theme.primaryColor } : {}}
            >
              {word}
            </motion.span>
          )
        })}
      </h1>
    </motion.div>
  );
}

function CounterLayout({ scene, start, end, prefix, fastRender, aspectRatio }: { scene: Scene, start: number, end: number, prefix: string, fastRender?: boolean, aspectRatio?: string }) {
  const [count, setCount] = React.useState(start);
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', textColor: '#FFFFFF' };
  
  React.useEffect(() => {
    let startTime: number;
    const duration = fastRender ? 400 : 1200; 
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [start, end, fastRender]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: fastRender ? 0.3 : 0.6, ease: "easeOut" }}
      className="flex flex-col items-center justify-center w-full px-4"
    >
      <motion.div 
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className={`font-display font-bold mb-4 tabular-nums ${aspectRatio === '9:16' ? 'text-6xl' : 'text-8xl md:text-9xl'}`}
        style={{ color: theme.primaryColor }}
      >
        {prefix}{count.toLocaleString()}
      </motion.div>
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: fastRender ? 0.1 : 0.5 }}
        className={`${aspectRatio === '9:16' ? 'text-xl' : 'text-2xl md:text-3xl'} font-medium font-display max-w-lg text-center`}
        style={{ color: theme.textColor }}
      >
        {scene.text}
      </motion.p>
    </motion.div>
  )
}

function PhoneLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = (scene.themeConfig || { cardColor: '#171717', primaryColor: '#FF5A00', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '3rem', backgroundColor: '#000000' }) as any;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex w-full h-full p-6 text-center ${isMobile ? 'flex-col items-center gap-6 justify-center' : 'flex-row items-center justify-center gap-12'}`}
      style={{ color: theme.textColor }}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0, rotate: -5 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.4, duration: fastRender ? 0.4 : 0.8 }}
        className={`w-[280px] h-[550px] overflow-hidden relative shrink-0 flex flex-col shadow-2xl ${isMobile ? 'scale-[0.65] transform-origin-center -mt-16' : ''}`}
        style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderWidth: '12px', borderRadius: theme.borderRadius }}
      >
        <div className="absolute top-0 inset-x-0 h-6 bg-transparent flex justify-center">
           <div className="w-1/3 h-5 rounded-b-2xl" style={{ backgroundColor: theme.secondaryColor }}></div>
        </div>
        <div className="flex-1 p-6 flex flex-col pt-16 items-center text-center relative overflow-hidden">
           {scene.layoutData?.url ? (
             <img src={scene.layoutData.url} alt="Mobile UI" className="absolute inset-0 w-full h-full object-cover opacity-60" />
           ) : (
             <>
               <motion.div 
                 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: fastRender ? 0.2 : 0.4 }}
                 className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 backdrop-blur-md relative z-10"
                 style={{ backgroundColor: theme.primaryColor, color: theme.backgroundColor }}
               >
                  <Sparkles size={32} />
               </motion.div>
               <div className="space-y-4 w-full relative z-10">
                 <motion.div initial={{ width: 0 }} animate={{ width: "75%" }} transition={{ delay: fastRender ? 0.3 : 0.6 }} className="h-4 rounded-full mx-auto" style={{ backgroundColor: theme.secondaryColor }} />
                 <motion.div initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ delay: fastRender ? 0.4 : 0.7 }} className="h-4 rounded-full mx-auto" style={{ backgroundColor: theme.secondaryColor }} />
               </div>
               
               <motion.div 
                 initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: fastRender ? 0.5 : 0.8 }}
                 className="mt-auto flex gap-2 w-full relative z-10"
               >
                 <div className="flex-1 h-20 rounded-2xl border p-3 backdrop-blur-md" style={{ borderColor: theme.secondaryColor, backgroundColor: theme.cardColor }}>
                    <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: theme.secondaryColor }}></div>
                    <div className="h-2 w-full rounded-full" style={{ backgroundColor: theme.secondaryColor }}></div>
                 </div>
                 <div className="flex-1 h-20 rounded-2xl border p-3 backdrop-blur-md" style={{ borderColor: theme.secondaryColor, backgroundColor: theme.cardColor }}>
                    <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: theme.secondaryColor }}></div>
                    <div className="h-2 w-full rounded-full" style={{ backgroundColor: theme.secondaryColor }}></div>
                 </div>
               </motion.div>
             </>
           )}
        </div>
      </motion.div>

      <div className={`flex-1 ${isMobile ? 'text-center' : 'text-left'}`}>
         <motion.h2 
           initial={{ x: -20, opacity: 0 }}
           animate={{ x: 0, opacity: 1 }}
           transition={{ delay: fastRender ? 0.1 : 0.3 }}
           className={`font-display font-bold leading-tight ${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl lg:text-6xl'}`}
         >
           {scene.text}
         </motion.h2>
      </div>
    </motion.div>
  )
}

function ImageCardLayout({ scene, url, fastRender, aspectRatio }: { scene: Scene, url: string, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', textColor: '#FFFFFF', borderRadius: '2rem' };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`w-full max-w-4xl flex px-6 ${isMobile ? 'flex-col gap-6 text-center justify-center' : 'flex-row gap-12 items-center'}`}
      style={{ color: theme.textColor }}
    >
      <motion.div
        initial={{ scale: 0.9, rotateY: 15, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={{ perspective: 1000, borderRadius: theme.borderRadius, borderColor: theme.textColor }}
        className={`w-full ${isMobile ? 'aspect-[4/3] max-w-[260px]' : 'aspect-square md:aspect-[4/5]'} overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border relative group mx-auto`}
      >
        <div className="absolute inset-0 bg-neutral-900 animate-pulse" /> {/* Placeholder while loading */}
        <img src={url} alt="Reference" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </motion.div>
      <div className={`flex flex-col ${isMobile ? 'items-center text-center' : 'text-left justify-center'}`}>
         <motion.div 
           initial={{ width: 0 }}
           animate={{ width: "3rem" }}
           transition={{ delay: fastRender ? 0.1 : 0.3 }}
           className="h-[3px] mb-4 md:mb-6"
           style={{ backgroundColor: theme.primaryColor }}
         />
         <motion.h2 
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: fastRender ? 0.2 : 0.4 }}
           className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-5xl'} font-display font-bold leading-tight`}
         >
           {scene.text}
         </motion.h2>
      </div>
    </motion.div>
  )
}

function BrowserLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = scene.themeConfig || { textColor: '#FFFFFF', cardColor: '#171717', secondaryColor: '#262626', borderRadius: '1rem', primaryColor: '#FF5A00', backgroundColor: '#000000' };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center justify-center w-full max-w-4xl ${isMobile ? 'gap-4 scale-90' : 'gap-8'}`}
    >
      <motion.div 
        initial={{ y: 50, rotateX: 10, scale: 0.95 }}
        animate={{ y: 0, rotateX: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3, duration: fastRender ? 0.4 : 0.8 }}
        style={{ perspective: 1000, backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
        className={`w-[95%] sm:w-[80%] ${isMobile ? 'aspect-[4/5]' : 'aspect-[16/10]'} border overflow-hidden shadow-2xl flex flex-col`}
      >
        {/* Header */}
        <div className="h-12 flex items-center px-4 gap-3 shrink-0 border-b relative" style={{ borderColor: theme.secondaryColor, backgroundColor: theme.secondaryColor }}>
          <div className="flex gap-2 shrink-0">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
            <div className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 h-7 rounded-md overflow-hidden relative mx-2 flex items-center px-3" style={{ backgroundColor: theme.backgroundColor || '#000000' }}>
            <Sparkles size={12} className="opacity-50 mr-2" style={{ color: theme.textColor }} />
            <div className="w-1/3 h-2 rounded-full opacity-50" style={{ backgroundColor: theme.textColor }} />
            <motion.div initial={{width: "0%"}} animate={{width: "100%"}} transition={{duration: fastRender ? 0.6 : 2}} className="absolute top-0 bottom-0 left-0 opacity-10" style={{ backgroundColor: theme.primaryColor }} />
            <motion.div initial={{x: "-100%"}} animate={{x: "200%"}} transition={{duration: fastRender ? 0.8 : 2.5, repeat: Infinity, ease: "linear"}} className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-10" />
          </div>
        </div>
        {/* Body animate */}
        <div className="p-8 flex flex-col gap-6 flex-1 relative overflow-hidden" style={{ backgroundColor: theme.cardColor }}>
           {scene.layoutData?.url ? (
             <img src={scene.layoutData.url} alt="UI Reference" className="absolute inset-0 w-full h-full object-cover opacity-50" />
           ) : (
             <>
               {/* skeleton blocks sliding up */}
               <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: fastRender ? 0.1 : 0.2}} className="w-1/2 h-10 rounded-lg relative z-10" style={{ backgroundColor: theme.secondaryColor }} />
               <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: fastRender ? 0.2 : 0.4}} className="grid grid-cols-3 gap-6 relative z-10">
                 <div className="h-32 rounded-xl" style={{ backgroundColor: theme.secondaryColor }} />
                 <div className="h-32 rounded-xl" style={{ backgroundColor: theme.secondaryColor }} />
                 <div className="h-32 rounded-xl" style={{ backgroundColor: theme.secondaryColor }} />
               </motion.div>
             </>
           )}
           {/* Text overlay */}
           <motion.div 
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: fastRender ? 0.3 : 0.6, duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
              style={{ backgroundColor: theme.cardColor + 'B3' }} // 70% opacity
           >
              <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl md:text-5xl'} font-display font-bold drop-shadow-2xl text-center px-4`} style={{ color: theme.textColor }}>
                 {scene.text}
              </h2>
           </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TabSwitchLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = (scene.themeConfig || { textColor: '#FFFFFF', cardColor: '#171717', secondaryColor: '#262626', primaryColor: '#FF5A00', borderRadius: '1.5rem', backgroundColor: '#000000' }) as any;
  const [activeTab, setActiveTab] = React.useState(0);
  React.useEffect(() => {
    const timer = setTimeout(() => setActiveTab(1), fastRender ? 300 : 800);
    return () => clearTimeout(timer);
  }, [fastRender]);
  
  return (
     <div className={`flex flex-col items-center justify-center w-full max-w-3xl text-center px-4 ${isMobile ? 'gap-6 scale-[0.85]' : 'gap-10'}`}>
        <motion.h2 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-display font-bold`}
          style={{ color: theme.textColor }}
        >
          {scene.text}
        </motion.h2>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full border overflow-hidden shadow-2xl p-3"
          style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
        >
           <div className="flex gap-2 mb-4 p-1.5 rounded-2xl relative overflow-hidden" style={{ backgroundColor: theme.secondaryColor }}>
              <div className={`flex-1 py-3 text-sm font-medium rounded-xl transition-colors z-10 shadow-md`} style={{ backgroundColor: activeTab === 0 ? theme.cardColor : 'transparent', color: activeTab === 0 ? theme.textColor : theme.secondaryColor }}>Dashboard</div>
              <div className={`flex-1 py-3 text-sm font-medium rounded-xl transition-colors z-10 shadow-md`} style={{ backgroundColor: activeTab === 1 ? theme.cardColor : 'transparent', color: activeTab === 1 ? theme.textColor : theme.secondaryColor }}>Analytics</div>
              <div className={`flex-1 py-3 text-sm font-medium rounded-xl transition-colors z-10 shadow-md`} style={{ backgroundColor: activeTab === 2 ? theme.cardColor : 'transparent', color: activeTab === 2 ? theme.textColor : theme.secondaryColor }}>Settings</div>
              
              <motion.div
                initial={{ x: 100, y: 100, opacity: 0 }}
                animate={{ x: "50%", y: 20, opacity: [0, 1, 0] }}
                transition={{ duration: fastRender ? 0.3 : 0.8 }}
                className="absolute pointer-events-none z-20 left-1/3"
              >
                 <MousePointer2 fill="white" className="drop-shadow-xl w-6 h-6" style={{ color: theme.textColor }} />
              </motion.div>
           </div>
           
           <div className="relative h-64 overflow-hidden rounded-2xl border" style={{ backgroundColor: theme.backgroundColor, borderColor: theme.secondaryColor }}>
              <AnimatePresence mode="popLayout">
                {activeTab === 0 && (
                   <motion.div key="t0" initial={{x: -50, opacity: 0}} animate={{x: 0, opacity: 1}} exit={{x: 50, opacity: 0}} className="w-full h-full p-6 flex flex-col gap-4">
                      <div className="w-1/3 h-6 rounded-md" style={{ backgroundColor: theme.secondaryColor }} />
                      <div className="w-2/3 h-6 rounded-md" style={{ backgroundColor: theme.secondaryColor }} />
                      <div className="w-1/2 h-6 rounded-md" style={{ backgroundColor: theme.secondaryColor }} />
                      <div className="w-full h-full mt-4 rounded-xl" style={{ backgroundColor: theme.secondaryColor }} />
                   </motion.div>
                )}
                {activeTab === 1 && (
                   <motion.div key="t1" initial={{x: -50, opacity: 0}} animate={{x: 0, opacity: 1}} exit={{x: 50, opacity: 0}} className="w-full h-full p-6 flex flex-col items-center justify-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full mb-6 flex items-center justify-center" style={{ backgroundColor: theme.primaryColor, boxShadow: `0 0 30px ${theme.primaryColor}` }}>
                         <Sparkles fill={theme.cardColor} size={32}/>
                      </motion.div>
                      <motion.div initial={{ width: 0 }} animate={{ width: "50%" }} className="h-6 rounded-md" style={{ backgroundColor: theme.primaryColor }} />
                   </motion.div>
                )}
              </AnimatePresence>
           </div>
        </motion.div>
     </div>
  )
}

function ButtonInteractLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = (scene.themeConfig || { primaryColor: '#FF5A00', cardColor: '#171717', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '9999px', backgroundColor: '#000000' }) as any;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center justify-center px-4 w-full ${isMobile ? 'gap-8' : 'gap-16'}`}
      style={{ color: theme.textColor }}
    >
       <motion.h2 
         initial={{ y: -20 }}
         animate={{ y: 0 }}
         className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-6xl'} font-display font-bold text-center`}
       >
         {scene.text}
       </motion.h2>
       <div className="relative w-[320px] h-[240px] flex items-center justify-center">
          {/* The Button */}
          <motion.div 
            animate={{ scale: [1, 0.95, 1.05, 1], backgroundColor: [theme.cardColor, theme.secondaryColor, theme.primaryColor, theme.primaryColor], color: [theme.textColor, theme.textColor, theme.backgroundColor, theme.backgroundColor] }}
            transition={{ duration: fastRender ? 0.4 : 1, times: [0, 0.4, 0.6, 1], delay: fastRender ? 0.2 : 0.5 }}
            className="px-10 py-5 font-bold text-lg shadow-xl z-10 border pointer-events-none"
            style={{ borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
          >
            Continue
          </motion.div>
          
          {/* The Cursor */}
          <motion.div
            initial={{ x: 150, y: 150, opacity: 0 }}
            animate={{ x: 10, y: 10, opacity: [0, 1, 1, 0] }}
            transition={{ duration: fastRender ? 0.4 : 1.2, delay: fastRender ? 0.1 : 0.3 }}
            className="absolute z-20"
          >
            <MousePointer2 fill={theme.textColor} className="drop-shadow-xl w-8 h-8" style={{ color: theme.textColor }} />
          </motion.div>
          
          {/* Ripple effect */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 2.5, opacity: [0, 1, 0] }}
            transition={{ delay: fastRender ? 0.35 : 0.9, duration: 0.6, ease: "easeOut" }}
            className="absolute w-32 h-32 border-2 rounded-full z-0 pointer-events-none"
            style={{ borderColor: theme.primaryColor }}
          />
       </div>
    </motion.div>
  )
}

function SearchBarLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', cardColor: '#171717', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '1rem', backgroundColor: '#000000' };

  const [phase, setPhase] = React.useState(0);
  const [displayedText, setDisplayedText] = React.useState('');

  React.useEffect(() => {
    const text = scene.text || '';
    if (!text) return;
    let i = 0;
    const typeDuration = fastRender ? 300 : 1000;
    const intervalTime = typeDuration / text.length;

    setDisplayedText('');
    setPhase(0);
    const timer = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setTimeout(() => setPhase(1), fastRender ? 100 : 400);
        setTimeout(() => setPhase(2), fastRender ? 400 : 1200);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [scene.text, fastRender]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center justify-center px-4 w-full max-w-2xl ${isMobile ? 'gap-6' : 'gap-8'}`}
    >
       <div 
         className="w-full flex items-center p-4 border shadow-2xl relative overflow-hidden"
         style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
       >
         <div className="w-8 h-8 mr-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: theme.secondaryColor }}>
           <Sparkles size={16} fill={theme.primaryColor} style={{ color: theme.primaryColor }} />
         </div>
         <div className="flex-1 overflow-hidden whitespace-nowrap">
           <div 
             className={`font-mono text-lg md:text-xl font-medium tracking-tight flex items-center`}
             style={{ color: theme.textColor }}
           >
             {displayedText}
             {phase === 0 && <span className="w-2 h-5 ml-1 animate-pulse" style={{ backgroundColor: theme.primaryColor }} />}
           </div>
         </div>
         
         {/* Loading bar along the bottom of the search bar */}
         {phase >= 1 && (
           <motion.div
             initial={{ width: 0 }}
             animate={{ width: "100%" }}
             transition={{ duration: fastRender ? 0.3 : 0.8 }}
             className="absolute bottom-0 left-0 h-1"
             style={{ backgroundColor: theme.primaryColor }}
           />
         )}
       </div>

       {/* Results Layout */}
       <AnimatePresence>
         {phase === 2 && (
           <motion.div 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="w-full p-6 border shadow-xl flex flex-col gap-5 origin-top"
             style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
           >
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full shrink-0" style={{ backgroundColor: theme.secondaryColor }} />
               <div className="w-full space-y-2">
                 <div className="w-1/3 h-4 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
                 <div className="w-1/4 h-3 rounded-full opacity-50" style={{ backgroundColor: theme.secondaryColor }} />
               </div>
             </div>
             <div className="w-[90%] h-4 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
             <div className="w-full h-4 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
             <div className="w-2/3 h-4 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
           </motion.div>
         )}
       </AnimatePresence>
    </motion.div>
  );
}

function ProfileCardLayout({ scene, url, fastRender, aspectRatio }: { scene: Scene, url: string, fastRender?: boolean, aspectRatio?: string }) {
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', cardColor: '#171717', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '2rem' };
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1 }}
      className={`flex flex-col items-center justify-center shadow-2xl border p-8 max-w-sm w-full mx-4 text-center`}
      style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
    >
      <motion.div
         initial={{ scale: 0 }}
         animate={{ scale: 1 }}
         transition={{ type: 'spring', damping: 12, delay: fastRender ? 0.1 : 0.3 }}
         className="w-32 h-32 rounded-full overflow-hidden mb-6 border-4"
         style={{ borderColor: theme.primaryColor }}
      >
        <img src={url} alt="Profile" className="w-full h-full object-cover" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: fastRender ? 0.2 : 0.5 }}
        className="text-3xl font-display font-bold mb-2"
        style={{ color: theme.textColor }}
      >
        {scene.text}
      </motion.h2>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "4rem" }}
        transition={{ delay: fastRender ? 0.3 : 0.7 }}
        className="h-1 mb-6 rounded-full"
        style={{ backgroundColor: theme.primaryColor }}
      />
      <div className="flex gap-3 w-full justify-center mt-2">
         <div className="w-10 h-10 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
         <div className="w-10 h-10 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
         <div className="w-10 h-10 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
      </div>
    </motion.div>
  )
}

function CodeEditorLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const isMobile = aspectRatio === '9:16';
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', cardColor: '#171717', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '1rem' };

  const [displayedText, setDisplayedText] = React.useState('');
  React.useEffect(() => {
    let i = 0;
    const text = scene.text || '';
    if (!text) return;
    const intervalTime = (fastRender ? 300 : 1000) / text.length;

    setDisplayedText('');
    const timer = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [scene.text, fastRender]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`w-[90%] max-w-3xl border shadow-2xl overflow-hidden flex flex-col font-mono text-xs md:text-sm`}
      style={{ backgroundColor: theme.cardColor, borderColor: theme.secondaryColor, borderRadius: theme.borderRadius }}
    >
       <div className="flex items-center px-4 py-2 border-b" style={{ borderColor: theme.secondaryColor, backgroundColor: theme.secondaryColor }}>
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
          <div className="w-3 h-3 rounded-full bg-green-500 mr-4" />
          <span className="opacity-50 font-medium" style={{ color: theme.textColor }}>script.ts</span>
       </div>
       <div className="p-6 flex flex-col gap-2 overflow-hidden text-left" style={{ color: theme.textColor }}>
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="opacity-50">import {'{'} generateAnimation {'}'} from '@kinetix/core';</motion.div>
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="opacity-50 mt-2">const scene = await generateAnimation("{'{'}</motion.div>
         
         <div 
            className="pl-6 text-lg md:text-xl font-bold py-2 leading-tight flex items-center"
            style={{ color: theme.primaryColor }}
         >
            prompt: "{displayedText}"<span className="w-2 h-4 ml-1 animate-pulse" style={{ backgroundColor: theme.primaryColor }} />
         </div>
         
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: fastRender ? 0.3 : 0.6 }} className="opacity-50">{"}'"}</motion.div>
       </div>
    </motion.div>
  )
}

function CustomHtmlLayout({ scene, fastRender, aspectRatio }: { scene: Scene, fastRender?: boolean, aspectRatio?: string }) {
  const theme = scene.themeConfig || { primaryColor: '#FF5A00', cardColor: '#171717', secondaryColor: '#262626', textColor: '#FFFFFF', borderRadius: '1rem', backgroundColor: '#000000' };

  React.useEffect(() => {
    // Dynamically inject CSS variables into a local scope so Tailwind classes like bg-[var(--theme-primary)] could potentially work if AI generates them,
    // though AI will mostly generate standard generic classes or inline styles.
  }, [theme]);

  // We wrap the raw HTML in a constrained container that forces it to scale nicely
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: fastRender ? 0.3 : 0.7, ease: "easeOut" }}
      className="w-full h-full flex items-center justify-center p-8 overflow-hidden pointer-events-none"
      style={{
        '--theme-primary': theme.primaryColor,
        '--theme-secondary': theme.secondaryColor,
        '--theme-bg': theme.backgroundColor,
        '--theme-card': theme.cardColor,
        '--theme-text': theme.textColor,
        '--theme-radius': theme.borderRadius,
      } as React.CSSProperties}
    >
      <div 
         className="w-full h-full flex flex-col items-center justify-center [&_*]:![transition:none]"
         style={{ color: theme.textColor, backgroundColor: theme.backgroundColor }}
         dangerouslySetInnerHTML={{ __html: scene.customHtml || '' }}
      />
    </motion.div>
  )
}

