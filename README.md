# PixelFlux (formerly MorphEngine)

A highly optimized, real-time computational image-rearrangement system and interactive drawing application. PixelFlux physically deconstructs source inputs (either hand-drawn strokes or uploaded images) and mathematically morphs them into a pre-defined target image via a stochastic spatial and color-matching algorithm.

## Features

- **Real-Time Physics Simulation:** Smooth 60fps particle physics with mass, spring dynamics, and friction.
- **Comet Trail Drawing:** Brush strokes remain solid as you paint and shatter into particles dynamically as they trail off or when you finish drawing.
- **Image Deconstruction:** Upload any image, watch it shatter into thousands of particles, and organically reform into the destination target shape.
- **Infinite Overpaint:** Even if the destination shape is fully saturated, the engine intelligently allows overlapping pixels, letting you overpaint the shape endlessly.
- **Advanced Spatial Hash Grid Search:** The engine maintains an $O(1)$ lookup spatial grid to guarantee particles snap to the closest, most color-accurate target pixel available, minimizing chaotic jumps.

## Tech Stack

- React 18
- TypeScript
- Vite
- Zustand (State Management)
- Tailwind CSS (Styling)
- Canvas 2D API (Rendering)
- Lucide React (Icons)

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

## How to Use

1. **Load Target Image:** In the left sidebar, upload the image you want the particles to ultimately form.
2. **Draw Mode:** Use the right sidebar to select colors and brush sizes. Draw on the canvas. Release your mouse (or hold still) to watch the paint shatter and fly towards the target shape.
3. **Image Mode:** Upload a source image to watch it instantly explode and reform into the target. You can continue painting directly over it!
