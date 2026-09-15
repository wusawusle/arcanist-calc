import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from the user's GitHub Pages project.
export default defineConfig({
  base: '/arcanist-calc/',
  plugins: [react()],
});
