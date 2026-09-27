import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { UnifiedCanvas } from './components/UnifiedCanvas';
import { extractParticles, matchParticles, Particle } from './engine/morphEngine';
import { Image as ImageIcon, Upload, Edit3, Settings } from 'lucide-react';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;

function App() {
  const { 
    targetImage, setTargetImage, 
    sourceImage, setSourceImage, 
    sourceMode, setSourceMode, 
    particleDensity, setParticleDensity 
  } = useAppStore();
  
  const [targetData, setTargetData] = useState<{x:number, y:number, r:number, g:number, b:number, a:number, size:number}[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);

  const handleTargetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setTargetImage(img);
      setTargetPreviewUrl(url);
    };
    img.src = url;
  };

  useEffect(() => {
    if (targetImage) {
      setTimeout(() => {
        const pts = extractParticles(targetImage, particleDensity, CANVAS_WIDTH, CANVAS_HEIGHT);
        setTargetData(pts);
      }, 0);
    }
  }, [targetImage, particleDensity]);

  useEffect(() => {
    if (targetData.length > 0 && sourceImage) {
      setTimeout(() => {
        const sourceData = extractParticles(sourceImage, particleDensity, CANVAS_WIDTH, CANVAS_HEIGHT);
        const matched = matchParticles(sourceData, targetData);
        setParticles(matched);
      }, 0);
    } else if (!sourceImage) {
      setParticles([]);
    }
  }, [sourceImage, targetData, particleDensity]);

  const handleSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
    };
    img.src = url;
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden text-zinc-100">
      
      {/* Left Dashboard Sidebar */}
      <div className="w-[280px] bg-[#141417] border-r border-zinc-800 flex flex-col h-full overflow-y-auto shrink-0 z-10">
        <div className="p-6 flex flex-col gap-6">
          <header>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-blue-500">Morph</span>Engine
            </h1>
            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">Real-time simulation</p>
          </header>

          <div className="bg-[#1a1a1e] rounded-xl p-4 border border-zinc-800 shadow-sm">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Target Image</span>
              {targetImage && (
                <label className="cursor-pointer text-[10px] text-blue-500 hover:text-blue-400 transition-colors font-bold">
                  REPLACE
                  <input type="file" accept="image/*" className="hidden" onChange={handleTargetUpload} />
                </label>
              )}
            </h3>
            
            {!targetImage ? (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 rounded-lg hover:bg-zinc-800 hover:border-zinc-500 transition-colors cursor-pointer group">
                <Upload size={24} className="text-zinc-500 mb-2 group-hover:text-blue-400 transition-colors" />
                <span className="text-xs font-medium text-zinc-400">Upload Target</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleTargetUpload} />
              </label>
            ) : (
              <div className="flex flex-col gap-3">
                {targetPreviewUrl && (
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-zinc-800 bg-white shadow-inner">
                    <img src={targetPreviewUrl} alt="Target" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>Target Particles:</span>
                  <span className="text-zinc-300 font-bold">{targetData.length.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#1a1a1e] rounded-xl p-4 border border-zinc-800 shadow-sm">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Settings size={12} /> Settings
            </h3>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 flex justify-between items-center font-bold">
                Particle Density
                <span className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-[10px] text-white">{particleDensity.toFixed(1)}</span>
              </label>
              <input 
                type="range" min="0.1" max="1.5" step="0.1" 
                value={particleDensity} 
                onChange={e => setParticleDensity(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-1" 
              />
              <p className="text-[9px] text-zinc-600 mt-2 leading-tight">Controls point extraction frequency. Affects detail & performance.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Arena */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a] relative">
        {/* Header / Mode Switcher */}
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a] z-10">
          <h2 className="text-sm font-bold text-zinc-100">Workspace</h2>
          
          <div className="flex bg-[#141417] rounded-lg p-1 border border-zinc-800 shadow-inner">
            <button 
              onClick={() => { setSourceMode('DRAW'); setSourceImage(null); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${sourceMode === 'DRAW' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
            >
              <Edit3 size={12} /> Draw Mode
            </button>
            <button 
              onClick={() => { setSourceMode('IMAGE'); setSourceImage(null); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all ${sourceMode === 'IMAGE' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
            >
              <ImageIcon size={12} /> Image Mode
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
          {!targetImage ? (
            <div className="m-auto flex flex-col items-center justify-center text-zinc-600 max-w-sm text-center">
              <ImageIcon size={48} className="mb-4 opacity-30" />
              <p className="text-sm">Upload a Target Image in the sidebar to begin morphing.</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {sourceMode === 'DRAW' ? (
                <UnifiedCanvas targetData={targetData} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
              ) : (
                <div className="w-full h-full flex flex-col relative">
                  {!sourceImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-50">
                      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-700 rounded-xl bg-[#121214] max-w-lg w-full hover:bg-zinc-900 transition-all cursor-pointer group"
                           onClick={() => document.getElementById('source-upload')?.click()}
                      >
                        <ImageIcon size={48} className="text-zinc-600 mb-4 group-hover:text-blue-500 transition-colors" />
                        <h4 className="text-sm font-bold mb-2 text-zinc-200">Upload Source Image</h4>
                        <p className="text-[11px] text-zinc-500 mb-6 text-center max-w-xs">This image will explode into particles. You can also paint over it!</p>
                        <span className="bg-zinc-800 text-white px-5 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider border border-zinc-700 shadow-sm">
                          Select Image
                        </span>
                        <input id="source-upload" type="file" accept="image/*" className="hidden" onChange={handleSourceUpload} />
                      </div>
                    </div>
                  ) : null}
                  
                  {/* We always render UnifiedCanvas so the right sidebar is visible even before uploading, but covered by overlay above */}
                  <UnifiedCanvas targetData={targetData} initialParticles={particles} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
