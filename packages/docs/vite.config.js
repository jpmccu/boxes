import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

/**
 * After the docs build completes, rebuild the web package (so its demo picks
 * up any core changes) and copy its output into dist/demo/ so that all
 * ./demo/ links in index.html resolve correctly.
 */
function copyWebDemo() {
  return {
    name: 'copy-web-demo',
    closeBundle() {
      const webDir = resolve(__dirname, '../web');
      const src = resolve(webDir, 'dist');
      const dst = resolve(__dirname, 'dist/demo');

      // Always rebuild the web package so the demo reflects the latest core
      // changes — the core dist is already up-to-date at this point because
      // the docs build (which runs first) resolves boxes-core from it.
      console.info('[copy-web-demo] Building packages/web...');
      try {
        execSync('npm run build', { cwd: webDir, stdio: 'inherit' });
      } catch (e) {
        console.warn('[copy-web-demo] packages/web build failed — demo may be stale:', e.message);
      }

      if (!existsSync(src)) {
        console.warn('[copy-web-demo] packages/web/dist not found — skipping demo copy.');
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
