import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  resolve: {
    alias: {
      // Resolve boxes-core to the pre-built dist so tutorial.js can import it.
      'boxes-core': resolve(__dirname, '../core/dist/boxes-core.js'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:         resolve(__dirname, 'index.html'),
        tutorial:     resolve(__dirname, 'tutorial.html'),
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
