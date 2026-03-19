import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:         resolve(__dirname, 'index.html'),
        api:          resolve(__dirname, 'api.html'),
        format:       resolve(__dirname, 'format.html'),
        embed:        resolve(__dirname, 'embed.html'),
        presentation: resolve(__dirname, 'presentation.html'),
      }
    }
  },
  server: {
    port: 4000
  }
});
