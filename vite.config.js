import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.VITE_BASE || '/romance-forge/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  server: {
    port: 5173,
    open: false,
    allowedHosts: true,
  },
});
