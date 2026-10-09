import { defineConfig } from 'vite';
import shareMeta from './scripts/share-meta.mjs';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [shareMeta()],
  base: process.env.VITE_BASE || '/romance-forge/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup-stories.js'],
  },
  server: {
    port: 5173,
    open: false,
    allowedHosts: true,
  },
});
