import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to the FastAPI server
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/tts': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/content': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2018',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
