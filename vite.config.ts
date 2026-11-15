import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths, so the build works under GitHub Pages' /TwistLab/ path as well as at a domain root.
  base: './',
  plugins: [react(), tailwindcss()],
  // The randomised big-cube tests take a few seconds on a busy machine or a CI runner; give them room.
  test: { include: ['src/**/*.test.{ts,tsx}'], testTimeout: 30_000 },
});
