import { create } from 'zustand';

interface AppState {
  targetImage: HTMLImageElement | null;
  setTargetImage: (img: HTMLImageElement | null) => void;
  
  sourceImage: HTMLImageElement | null;
  setSourceImage: (img: HTMLImageElement | null) => void;
  
  sourceMode: 'DRAW' | 'IMAGE';
  setSourceMode: (mode: 'DRAW' | 'IMAGE') => void;
  
  particleDensity: number;
  setParticleDensity: (density: number) => void;
  
  particleSpeed: number;
  setParticleSpeed: (speed: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  targetImage: null,
  setTargetImage: (img) => set({ targetImage: img }),
  
  sourceImage: null,
  setSourceImage: (img) => set({ sourceImage: img }),
  
  sourceMode: 'DRAW',
  setSourceMode: (mode) => set({ sourceMode: mode }),
  
  particleDensity: 1.0,
  setParticleDensity: (density) => set({ particleDensity: density }),
  
  particleSpeed: 1.0,
  setParticleSpeed: (speed) => set({ particleSpeed: speed }),
}));
