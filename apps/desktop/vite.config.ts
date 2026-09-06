import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Renderer build. In development the dev server proxies `/api` to the local
 * FICMS API (used by the browser live preview too); in production the same
 * relative `/api` base is resolved by the Electron main process, which points
 * the renderer at the embedded standalone backend or a configured server.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // The sandbox preview is served under an ephemeral e2b.app host; allow it.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.FICMS_DEV_API ?? 'http://127.0.0.1:4123',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022'
  }
});
