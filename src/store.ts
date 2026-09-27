import { create } from 'zustand';

interface AppState {
  targetImage: HTMLImageElement | null;
  setTargetImage: (img: HTMLImageElement | null) => void;
  
  sourceImage: HTMLImageElement | HTMLCanvasElement | null;
  setSourceImage: (img: HTMLImageElement | HTMLCanvasElement | null) => void;

  sourceMode: 'DRAW' | 'IMAGE';
  setSourceMode: (mode: 'DRAW' | 'IMAGE') => void;

  particleDensity: number;
  setParticleDensity: (d: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  targetImage: null,
  setTargetImage: (targetImage) => set({ targetImage }),

  sourceImage: null,
  setSourceImage: (sourceImage) => set({ sourceImage }),

  sourceMode: 'DRAW',
  setSourceMode: (sourceMode) => set({ sourceMode }),

  particleDensity: 1.2,
  setParticleDensity: (particleDensity) => set({ particleDensity })
}));
