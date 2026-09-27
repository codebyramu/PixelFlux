import React, { useEffect, useRef, useState } from 'react';
import { Particle } from '../engine/morphEngine';
import { Pen, Eraser, Undo2, Redo2, Trash2, Image as ImageIcon, Paintbrush, Pipette } from 'lucide-react';
import { HexColorPicker } from "react-colorful";

export interface TargetNode {
  x: number; y: number;
  r: number; g: number; b: number; a: number;
  size: number;
  used: boolean;
}

interface UnifiedCanvasProps {
  targetData: Omit<TargetNode, "used">[];
  initialParticles?: Particle[];
  particleSpeed: number;
  width: number;
  height: number;
  targetPreviewUrl?: string | null;
}

export const UnifiedCanvas: React.FC<UnifiedCanvasProps> = ({ targetData, initialParticles, particleSpeed, width, height, targetPreviewUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Convert these UI states to refs for rAF efficiency where possible, but we need React state for the UI re-renders
  const [color, setColor] = useState('#ef4444');
  const colorRef = useRef('#ef4444');
  useEffect(() => { colorRef.current = color; }, [color]);

  const [brushSize, setBrushSize] = useState(12);
  const brushSizeRef = useRef(12);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const activeToolRef = useRef<'pen' | 'eraser'>('pen');
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const particleSpeedRef = useRef(particleSpeed);
  useEffect(() => { particleSpeedRef.current = particleSpeed; }, [particleSpeed]);

  const [showPicker, setShowPicker] = useState(false);
  const [, setForceRender] = useState(0);
  const [isCanvasEmptyUI, setIsCanvasEmptyUI] = useState(true);
  
  const liveParticles = useRef<any[]>([]);
  const availableTargets = useRef<TargetNode[]>([]);
  const gridRef = useRef<Map<string, TargetNode[]>>(new Map());
  const usedCountRef = useRef(0);
  const gridSize = 20;
  
  const currentStroke = useRef<{x: number, y: number}[]>([]);
  const isDrawing = useRef(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);
  const idleTimeout = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef(0);

  // Unmount cleanup for idle timer
  useEffect(() => {
    return () => {
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, []);

  // Effect 1: Handle Target Data Changes (e.g. Density Slider)
  // We do NOT clear liveParticles here. We let drawn particles keep flying to their destinations.
  useEffect(() => {
    const targets = targetData.map(t => ({ ...t, used: false }));
    const grid = new Map<string, TargetNode[]>();
    
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const cx = Math.floor(t.x / gridSize);
      const cy = Math.floor(t.y / gridSize);
      // Bitwise key optimization to reduce string allocation overhead
      const key = ((cx << 16) ^ cy).toString();
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(t);
    }
    
    gridRef.current = grid;
    availableTargets.current = targets;
    usedCountRef.current = 0; 
    setForceRender(v => v + 1);
  }, [targetData]);

  // Effect 2: Handle Initial Particles (Source Image Morph)
  useEffect(() => {
    if (initialParticles) {
      const grid = gridRef.current;
      const newLive: any[] = [];
      let usedCount = 0;

      initialParticles.forEach(p => {
        newLive.push({
          x: p.sx, y: p.sy,
          vx: 0, 
          vy: 0,
          tx: p.tx, ty: p.ty,
          size: p.size,
          color: p.color
        });
        
        const cx = Math.floor(p.tx / gridSize);
        const cy = Math.floor(p.ty / gridSize);
        const key = ((cx << 16) ^ cy).toString();
        const cell = grid.get(key);
        if (cell) {
          const t = cell.find(t => t.x === p.tx && t.y === p.ty && !t.used);
          if (t) {
            t.used = true;
            usedCount++;
          }
        }
      });
      
      liveParticles.current = newLive;
      usedCountRef.current = usedCount;
      holdTimerRef.current = 90; // Hold at source position for 1.5 seconds
      setIsCanvasEmptyUI(false);
      setForceRender(v => v + 1);
    }
  }, [initialParticles]);

  const handleEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        setColor(result.sRGBHex);
        setActiveTool('pen');
      } catch (e) {
        console.log('Eyedropper cancelled');
      }
    } else {
      alert("Your browser doesn't support the Eyedropper API yet!");
    }
  };

  const spawnParticlesBetween = (x1: number, y1: number, x2: number, y2: number) => {
    if (availableTargets.current.length === 0) return; // Guard against empty targets (pure white image)

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const stepSize = activeToolRef.current === 'eraser' ? 5 : Math.max(2, brushSizeRef.current / 2);
    const steps = dist === 0 ? 0 : Math.max(1, Math.floor(dist / stepSize));
    
    if (activeToolRef.current === 'eraser') {
      const eraseRadiusSq = (brushSizeRef.current / 2) ** 2; // FIXED: Accurate eraser radius
      const newLive = [];
      const targetsToFree: {tx: number, ty: number}[] = [];
      
      for (let i = 0; i < liveParticles.current.length; i++) {
        const p = liveParticles.current[i];
        let erased = false;
        
        for (let s = 0; s <= steps; s++) {
          const px = steps === 0 ? x1 : x1 + (dx * s) / steps;
          const py = steps === 0 ? y1 : y1 + (dy * s) / steps;
          const distSq = (p.x - px)**2 + (p.y - py)**2;
          if (distSq <= eraseRadiusSq) {
            erased = true;
            break;
          }
        }
        
        if (erased) {
           targetsToFree.push({ tx: p.tx, ty: p.ty });
        } else {
           newLive.push(p);
        }
      }
      
      liveParticles.current = newLive;
      
      if (targetsToFree.length > 0) {
         const grid = gridRef.current;
         targetsToFree.forEach(({tx, ty}) => {
            const cx = Math.floor(tx / gridSize);
            const cy = Math.floor(ty / gridSize);
            const key = ((cx << 16) ^ cy).toString();
            const cell = grid.get(key);
            if (cell) {
               const t = cell.find(t => t.x === tx && t.y === ty);
               if (t && t.used) {
                 t.used = false;
                 usedCountRef.current--;
               }
            }
         });
         setForceRender(v => v + 1);
      }
      return;
    }
    
    const hex = colorRef.current.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    const grid = gridRef.current;
    const targets = availableTargets.current;
    
    for (let i = 0; i <= steps; i++) {
      const px = steps === 0 ? x1 : x1 + (dx * i) / steps;
      const py = steps === 0 ? y1 : y1 + (dy * i) / steps;
      
      const numParticlesPerStep = Math.max(1, Math.floor(brushSizeRef.current / 4));
      
      for (let j = 0; j < numParticlesPerStep; j++) {
        const offsetX = (Math.random() - 0.5) * brushSizeRef.current;
        const offsetY = (Math.random() - 0.5) * brushSizeRef.current;
        const sx = px + offsetX;
        const sy = py + offsetY;
        
        let bestTarget: TargetNode | null = null;
        let minScore = Infinity;
        
        const cx = Math.floor(sx / gridSize);
        const cy = Math.floor(sy / gridSize);
        
        for (let gdx = -3; gdx <= 3; gdx++) {
          for (let gdy = -3; gdy <= 3; gdy++) {
            const key = (((cx + gdx) << 16) ^ (cy + gdy)).toString();
            const cell = grid.get(key);
            if (cell) {
              for (let c = 0; c < cell.length; c++) {
                const t = cell[c];
                if (t.used) continue;
                
                const spaceDist = (sx - t.x) ** 2 + (sy - t.y) ** 2;
                const colorDist = (r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2;
                const score = spaceDist + colorDist * 15.0; 
                
                if (score < minScore) {
                  minScore = score;
                  bestTarget = t;
                }
              }
            }
          }
        }
        
        if (!bestTarget || minScore > 50000) {
          for (let k = 0; k < 100; k++) {
            const idx = Math.floor(Math.random() * targets.length);
            const t = targets[idx];
            if (t.used) continue;
            
            const spaceDist = (sx - t.x) ** 2 + (sy - t.y) ** 2;
            const colorDist = (r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2;
            const score = spaceDist + colorDist * 15.0; 
            
            if (score < minScore) {
              minScore = score;
              bestTarget = t;
            }
          }
        }
        
        if (!bestTarget) {
          bestTarget = targets[Math.floor(Math.random() * targets.length)];
        }
        
        if (bestTarget) {
          if (!bestTarget.used) {
            bestTarget.used = true;
            usedCountRef.current++;
          }
          
          // SOFT DISSOLVE: Pixels gracefully detach with almost zero velocity and let the spring pull them
          liveParticles.current.push({
            x: sx, y: sy,
            vx: (Math.random() - 0.5) * 0.5, 
            vy: (Math.random() - 0.5) * 0.5,
            tx: bestTarget.x, ty: bestTarget.y,
            size: bestTarget.size,
            color: colorRef.current
          });
        }
      }
    }
  };

  const getCoordinates = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    
    // Correcting for aspect-square sizing to prevent offset bugs
    const containerAspect = rect.width / rect.height;
    const canvasAspect = canvas.width / canvas.height;
    let renderW = rect.width;
    let renderH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > canvasAspect) {
      renderW = rect.height * canvasAspect;
      offsetX = (rect.width - renderW) / 2;
    } else {
      renderH = rect.width / canvasAspect;
      offsetY = (rect.height - renderH) / 2;
    }

    const scale = canvas.width / renderW;
    return {
      x: (e.clientX - rect.left - offsetX) * scale,
      y: (e.clientY - rect.top - offsetY) * scale
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only left clicks
    if (showPicker) setShowPicker(false);
    
    const coords = getCoordinates(e);
    if (coords) {
      setIsCanvasEmptyUI(false);
      isDrawing.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      currentStroke.current = [coords];
      lastPos.current = coords;
      
      if (activeToolRef.current === 'eraser') {
        spawnParticlesBetween(coords.x, coords.y, coords.x, coords.y);
      } else {
        if (idleTimeout.current) clearTimeout(idleTimeout.current);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const coords = getCoordinates(e);
    if (coords && lastPos.current) {
      if (activeToolRef.current === 'eraser') {
        spawnParticlesBetween(lastPos.current.x, lastPos.current.y, coords.x, coords.y);
        lastPos.current = coords;
        currentStroke.current.push(coords);
        if (currentStroke.current.length > 5) currentStroke.current.shift();
      } else {
        // Pen Mode - spawn segments immediately during move
        spawnParticlesBetween(lastPos.current.x, lastPos.current.y, coords.x, coords.y);
        currentStroke.current.push(coords);
        lastPos.current = coords;
        
        if (idleTimeout.current) clearTimeout(idleTimeout.current);
        if (currentStroke.current.length > 15) {
          currentStroke.current.shift(); 
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDrawing.current) {
      isDrawing.current = false;
      lastPos.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      
      if (activeToolRef.current !== 'eraser') {
        const stroke = currentStroke.current;
        if (stroke.length === 1) {
          spawnParticlesBetween(stroke[0].x, stroke[0].y, stroke[0].x, stroke[0].y);
        }
      }
      
      currentStroke.current = [];
      setForceRender(v => v + 1);
    }
  };

  useEffect(() => {
    let animationFrame: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      // Clear canvas (transparent to show ghost background)
      ctx.clearRect(0, 0, width, height);
      
      const friction = 0.98; 
      const spring = 0.0001 * particleSpeedRef.current; 
      const maxSpeed = 1.0 * particleSpeedRef.current; 
      const maxSpeedSq = maxSpeed * maxSpeed;

      let isHolding = false;
      if (holdTimerRef.current > 0) {
        holdTimerRef.current--;
        isHolding = true;
      } else if (holdTimerRef.current === 0) {
        const particles = liveParticles.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.vx === 0 && p.vy === 0) {
            const angle = Math.random() * Math.PI * 2;
            const speedMagnitude = Math.random() * 8 + 4;
            p.vx = Math.cos(angle) * speedMagnitude;
            p.vy = Math.sin(angle) * speedMagnitude;
          }
        }
        holdTimerRef.current = -1;
      }

      const particles = liveParticles.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        if (!isHolding) {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          
          p.vx += dx * spring;
          p.vy += dy * spring;
          
          p.vx *= friction;
          p.vy *= friction;
          
          const speedSq = p.vx * p.vx + p.vy * p.vy;
          if (speedSq > maxSpeedSq) {
             const speed = Math.sqrt(speedSq);
             p.vx = (p.vx / speed) * maxSpeed;
             p.vy = (p.vy / speed) * maxSpeed;
          }
          
          p.x += p.vx;
          p.y += p.vy;
        }

        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }
      
      const stroke = currentStroke.current;
      if (stroke.length > 0) {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.strokeStyle = activeToolRef.current === 'eraser' ? 'rgba(255, 255, 240, 0.15)' : colorRef.current;
        ctx.lineWidth = brushSizeRef.current;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      
      animationFrame = requestAnimationFrame(loop);
    };
    
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [width, height]);

  const presetColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ffffff', '#000000'];
  const remaining = availableTargets.current.length - usedCountRef.current;

  return (
    <div className="flex flex-row w-full h-full items-stretch bg-[#0a0a0a]">
      
      <div className="flex-1 relative p-6 flex flex-col items-center justify-center">
        <div 
          className="relative border border-zinc-800 bg-[#121214] rounded-lg shadow-2xl overflow-hidden aspect-square flex flex-col items-center justify-center max-h-full"
          style={{ height: '100%', maxHeight: 'calc(100vh - 120px)' }}
        >
          {targetPreviewUrl && (
             <div 
               className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none bg-center bg-contain bg-no-repeat transition-opacity"
               style={{ backgroundImage: `url(${targetPreviewUrl})`, margin: '10%' }}
             />
          )}

          {isCanvasEmptyUI && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 z-0">
              <ImageIcon size={48} className="mb-4 text-zinc-500" />
              <p className="text-zinc-500 text-sm font-medium">Draw something to begin morphing.</p>
            </div>
          )}
          
          <canvas 
            ref={canvasRef} 
            width={width} 
            height={height} 
            className="block w-full h-full object-contain touch-none z-10"
            style={{ cursor: activeTool === 'eraser' ? 'crosshair' : 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </div>

      <div className="w-[280px] shrink-0 flex flex-col p-6 bg-[#141417] border-l border-zinc-800 h-full overflow-y-auto z-10">
        
        <div className="flex items-center gap-2 mb-6">
          <Paintbrush size={14} className="text-zinc-400" />
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Paint Tools</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <button onClick={() => setActiveTool('pen')} className={`flex items-center justify-center py-4 rounded-lg border transition-all ${activeTool === 'pen' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#1a1a1e] border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}>
            <Pen size={18} />
          </button>
          <button onClick={() => setActiveTool('eraser')} className={`flex items-center justify-center py-4 rounded-lg border transition-all ${activeTool === 'eraser' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-[#1a1a1e] border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}>
            <Eraser size={18} />
          </button>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Brush Size</h3>
            <div className="bg-[#1a1a1e] border border-zinc-800 text-zinc-300 text-[10px] px-2 py-1 rounded font-mono">
              {brushSize} px
            </div>
          </div>
          <input 
            type="range" min="2" max="50" 
            value={brushSize} 
            onChange={e => setBrushSize(parseInt(e.target.value))} 
            className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
          />
        </div>

        <div className="mb-8">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Color</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {presetColors.map(c => (
              <button 
                key={c}
                onClick={() => { setColor(c); setActiveTool('pen'); }}
                className={`w-8 h-8 rounded-full border-2 transition-transform shadow-md mx-auto ${color === c && activeTool === 'pen' ? 'scale-110 border-white ring-2 ring-blue-500/50' : 'border-zinc-700 hover:scale-105'}`}
                style={{ backgroundColor: c }}
                title={`Use color ${c}`}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-2 relative">
            <div 
              className="flex-1 flex items-center justify-between bg-[#1a1a1e] p-3 rounded-lg border border-zinc-800 transition-colors hover:border-zinc-700 cursor-pointer"
              onClick={() => setShowPicker(!showPicker)}
            >
              <span className="text-xs text-zinc-300 font-medium">Custom</span>
              <div 
                className="w-6 h-6 rounded border border-zinc-600" 
                style={{ backgroundColor: color }} 
              />
            </div>
            
            <button 
              onClick={handleEyedropper}
              className="flex items-center justify-center p-3 h-full rounded-lg bg-[#1a1a1e] border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 transition-colors"
              title="Pick color from screen"
            >
              <Pipette size={18} />
            </button>
            
            {showPicker && (
              <div className="absolute right-0 top-full mt-2 z-50">
                <div className="fixed inset-0" onClick={() => setShowPicker(false)} />
                <div className="relative z-50 bg-[#1a1a1e] p-3 rounded-lg border border-zinc-700 shadow-2xl overflow-hidden">
                  <HexColorPicker color={color} onChange={(c) => { setColor(c); setActiveTool('pen'); }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8 opacity-50 pointer-events-none" title="Coming soon">
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-[#1a1a1e] border border-zinc-800 text-zinc-500">
            <Undo2 size={14} />
            <span className="text-[9px] font-bold">Undo</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-[#1a1a1e] border border-zinc-800 text-zinc-500">
            <Redo2 size={14} />
            <span className="text-[9px] font-bold">Redo</span>
          </button>
          <button 
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-[#1a1a1e] border border-zinc-800 text-zinc-500"
          >
            <Trash2 size={14} />
            <span className="text-[9px] font-bold">Clear</span>
          </button>
        </div>

        <div className="h-px w-full bg-zinc-800 my-2"></div>
        
        <div className="mt-auto flex flex-col gap-4">
          <div className="text-center">
            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Target Pixels Left</div>
            <div className="text-lg font-mono text-zinc-200">{Math.max(0, remaining).toLocaleString()}</div>
          </div>
          
          <button 
            onClick={() => { 
              liveParticles.current = []; 
              availableTargets.current.forEach(t => t.used = false);
              usedCountRef.current = 0;
              currentStroke.current = [];
              setIsCanvasEmptyUI(true);
              setForceRender(v => v + 1);
            }} 
            className="w-full py-3 bg-transparent hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 hover:border-red-500/60 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> CLEAR CANVAS
          </button>
        </div>
      </div>
      
    </div>
  );
};
