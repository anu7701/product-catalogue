import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API's address in development; the browser only ever calls /api on the
// same origin, and Vite forwards it (no CORS, ARCHITECTURE §10.1).
const API_DEV_TARGET = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  // Build-time settings (VITE_*) come from the repo-root .env, like the API's.
  envDir: '../..',
  server: {
    host: '127.0.0.1',
    proxy: { '/api': API_DEV_TARGET },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
