import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  root: 'web',
  base: mode === 'static' ? './' : '/',
  publicDir: '../public',
  plugins: [react()],
  define: { __STATIC_MODE__: JSON.stringify(mode === 'static') },
  build: { outDir: '../dist', emptyOutDir: true, assetsInlineLimit: 0 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
}));
