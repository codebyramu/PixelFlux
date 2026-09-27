export interface Particle {
  id: number;
  sx: number; sy: number;
  tx: number; ty: number;
  color: string;
  targetColor: string;
  size: number;
}

export function extractParticles(
  image: HTMLImageElement | HTMLCanvasElement, 
  density: number, 
  maxWidth: number, 
  maxHeight: number
): { x: number, y: number, r: number, g: number, b: number, a: number, size: number }[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const w = Math.floor(image.width * scale);
  const h = Math.floor(image.height * scale);
  
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(image, 0, 0, w, h);
  
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  
  const particles = [];
  // Vastly reduce particle count to fix lag. Minimum step is 3.
  const step = Math.max(3, Math.floor(4 / density)); 
  
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];
      
      const isWhite = r > 240 && g > 240 && b > 240;
      if (a > 50 && !isWhite) {
        const offsetX = (maxWidth - w) / 2;
        const offsetY = (maxHeight - h) / 2;
        particles.push({ x: x + offsetX, y: y + offsetY, r, g, b, a, size: step + 0.5 });
      }
    }
  }
  return particles;
}

export function matchParticles(
  source: { x: number, y: number, r: number, g: number, b: number, a: number, size: number }[],
  target: { x: number, y: number, r: number, g: number, b: number, a: number, size: number }[]
): Particle[] {
  if (target.length === 0 || source.length === 0) return [];

  const particles: Particle[] = [];
  const colorWeight = 10.0;
  
  // For Image Mode, we map TARGET -> SOURCE.
  // This guarantees the target shape is 100% complete.
  
  const gridSize = 20;
  const grid = new Map<string, typeof source>();
  
  for (let i = 0; i < source.length; i++) {
    const s = source[i];
    const cx = Math.floor(s.x / gridSize);
    const cy = Math.floor(s.y / gridSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(s);
  }

  for (let i = 0; i < target.length; i++) {
    const t = target[i];
    let bestSource = source[0];
    let minScore = Infinity;
    
    const cx = Math.floor(t.x / gridSize);
    const cy = Math.floor(t.y / gridSize);
    
    // Check local spatial neighbors for closest spatial/color match
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const cell = grid.get(`${cx + dx},${cy + dy}`);
        if (cell) {
          for (let j = 0; j < cell.length; j++) {
            const s = cell[j];
            const spaceDist = (s.x - t.x) ** 2 + (s.y - t.y) ** 2;
            const colorDist = (s.r - t.r) ** 2 + (s.g - t.g) ** 2 + (s.b - t.b) ** 2;
            const score = spaceDist + colorDist * colorWeight;
            if (score < minScore) {
              minScore = score;
              bestSource = s;
            }
          }
        }
      }
    }
    
    // Global fallback random sampling if color mismatch was too high
    if (minScore > 30000) {
      for (let k = 0; k < 50; k++) {
        const s = source[Math.floor(Math.random() * source.length)];
        const spaceDist = (s.x - t.x) ** 2 + (s.y - t.y) ** 2;
        const colorDist = (s.r - t.r) ** 2 + (s.g - t.g) ** 2 + (s.b - t.b) ** 2;
        const score = spaceDist + colorDist * colorWeight;
        if (score < minScore) {
          minScore = score;
          bestSource = s;
        }
      }
    }
    
    particles.push({
      id: i, // ID is based on target index to keep it stable
      sx: bestSource.x,
      sy: bestSource.y,
      tx: t.x,
      ty: t.y,
      size: Math.max(bestSource.size, t.size),
      color: `rgba(${bestSource.r}, ${bestSource.g}, ${bestSource.b}, ${bestSource.a / 255})`,
      targetColor: `rgba(${t.r}, ${t.g}, ${t.b}, ${t.a / 255})`
    });
  }
  
  return particles;
}
