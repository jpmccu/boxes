import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  resolve: {
    alias: {
      '/core/boxes-core.js': resolve(__dirname, '../core/dist/boxes-core.js')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html')
      }
    }
  },
  server: {
    port: 3000
  }
});
