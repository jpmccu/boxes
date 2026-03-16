import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        api: resolve(__dirname, 'api.html'),
        demo: resolve(__dirname, 'demo.html'),
      }
    }
  },
  server: {
    port: 4000
  }
});
