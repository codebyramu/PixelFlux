export interface Particle {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  color: string;
  r: number;
  g: number;
  b: number;
  tr: number;
  tg: number;
  tb: number;
  size: number;
}

export interface TargetNode {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  size: number;
}

export function extractParticles(img: HTMLImageElement, density: number, canvasWidth: number, canvasHeight: number): any[] {
  if (!img.width || !img.height) return [];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height) * 0.8;
  const w = Math.floor(img.width * scale);
  const h = Math.floor(img.height * scale);
  
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  
  const imgData = ctx.getImageData(0, 0, w, h).data;
  const particles = [];
  
  const offsetX = (canvasWidth - w) / 2;
  const offsetY = (canvasHeight - h) / 2;

  const step = Math.max(3, Math.floor(4 / density));
  const pSize = Math.max(2, Math.floor(step * 0.8));

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = imgData[i];
      const g = imgData[i+1];
      const b = imgData[i+2];
      const a = imgData[i+3];
      
      const isWhite = r > 240 && g > 240 && b > 240;
      
      if (a > 50 && !isWhite) {
        particles.push({
          x: x + offsetX,
          y: y + offsetY,
          r, g, b, a,
          size: pSize
        });
      }
    }
  }
  
  return particles;
}

export function matchParticles(source: any[], target: TargetNode[]): Particle[] {
  if (!target.length || !source.length) return [];

  const unassigned = [...source];
  const targets = target.map(t => ({ ...t, owner: null as any | null, bestScore: Infinity }));
  
  const result: Particle[] = [];
  
  let loopLimit = source.length * 10;
  
  while (unassigned.length > 0 && loopLimit > 0) {
    loopLimit--;
    const p = unassigned.pop()!;
    
    let bestTarget = null;
    let minScore = Infinity;
    
    for (let i = 0; i < 200; i++) {
      const idx = Math.floor(Math.random() * targets.length);
      const t = targets[idx];
      
      const spaceDist = (p.x - t.x) ** 2 + (p.y - t.y) ** 2;
      const colorDist = (p.r - t.r) ** 2 + (p.g - t.g) ** 2 + (p.b - t.b) ** 2;
      const score = spaceDist + colorDist * 15.0; 
      
      if (score < t.bestScore && score < minScore) {
        minScore = score;
        bestTarget = t;
      }
    }
    
    if (bestTarget) {
      if (bestTarget.owner) {
        unassigned.push(bestTarget.owner); 
      }
      bestTarget.owner = p;
      bestTarget.bestScore = minScore;
      
      p.tx = bestTarget.x;
      p.ty = bestTarget.y;
      p.tr = bestTarget.r;
      p.tg = bestTarget.g;
      p.tb = bestTarget.b;
    } else {
      const backupTarget = targets[Math.floor(Math.random() * targets.length)];
      p.tx = backupTarget.x;
      p.ty = backupTarget.y;
      p.tr = backupTarget.r;
      p.tg = backupTarget.g;
      p.tb = backupTarget.b;
    }
  }

  for (let i = 0; i < source.length; i++) {
    const p = source[i];
    if (p.tx !== undefined && p.ty !== undefined) {
      
      // Calculate Luminance to preserve Source Hue but match Target 3D lighting!
      const lT = 0.299 * p.tr + 0.587 * p.tg + 0.114 * p.tb;
      const lS = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
      
      let targetR = p.r;
      let targetG = p.g;
      let targetB = p.b;

      if (lS > 10) {
         const scale = Math.max(0.15, Math.min(2.5, lT / lS)); 
         targetR = Math.min(255, p.r * scale);
         targetG = Math.min(255, p.g * scale);
         targetB = Math.min(255, p.b * scale);
      } else {
         targetR = p.tr * 0.2;
         targetG = p.tg * 0.2;
         targetB = p.tb * 0.2;
      }
      
      // Blend 80% Source Color with 20% Target Color for cohesion
      targetR = (targetR * 0.8) + (p.tr * 0.2);
      targetG = (targetG * 0.8) + (p.tg * 0.2);
      targetB = (targetB * 0.8) + (p.tb * 0.2);

      result.push({
        x: p.x,
        y: p.y,
        sx: p.x,
        sy: p.y,
        tx: p.tx,
        ty: p.ty,
        color: `rgb(${p.r},${p.g},${p.b})`,
        r: p.r,
        g: p.g,
        b: p.b,
        tr: targetR,
        tg: targetG,
        tb: targetB,
        size: p.size
      });
    }
  }
  
  return result;
}
