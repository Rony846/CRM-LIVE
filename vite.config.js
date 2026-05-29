import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The staff app talks to the existing MuscleGrid CRM backend. In dev we proxy
// /api -> the local FastAPI so there's no CORS dance and the export's
// localStorage-JWT pattern works unchanged. Override the target with
// VITE_API_PROXY when pointing at a remote/staging backend.
const API_TARGET = process.env.VITE_API_PROXY || 'http://127.0.0.1:8001';

export default defineConfig({
  // PWA build is served under /staff/ by the CRM nginx. The native (Capacitor)
  // build serves the bundle from the WebView root, so it builds with base '/'
  // via `VITE_BASE=/` (see the build:native script).
  base: process.env.VITE_BASE || '/staff/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
});
