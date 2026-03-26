import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';

/**
 * After the docs build completes, copy the pre-built web app into dist/demo/
 * so that all ./demo/ links in index.html resolve correctly.
 *
 * The web package must be built first (packages/web/dist/ must exist).
 */
function copyWebDemo() {
  return {
    name: 'copy-web-demo',
    closeBundle() {
      const src = resolve(__dirname, '../web/dist');
      const dst = resolve(__dirname, 'dist/demo');
      if (!existsSync(src)) {
        console.warn('[copy-web-demo] packages/web/dist not found — skipping demo copy. Run `npm run build` in packages/web first.');
        return;
      }
      mkdirSync(dst, { recursive: true });
      cpSync(src, dst, { recursive: true });
      console.info('[copy-web-demo] Copied packages/web/dist → dist/demo');
    },
  };
}

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
  plugins: [copyWebDemo()],
  server: {
    port: 4000,
    proxy: {
      // In dev mode, proxy /demo/ requests to the web package's Vite dev server.
      '/demo': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/demo/, ''),
        changeOrigin: true,
      }
    }
  }
});
