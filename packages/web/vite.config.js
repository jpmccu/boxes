import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync } from 'fs';

function suppressKnownEvalWarnings(warning, warn) {
  // cytoscape-pdf-export (via PDFKit) uses eval() in its webpack bundle.
  // The warning surfaces both in the core build and in packages that include
  // the pre-built core dist. Suppress it for those known sources.
  if (warning.code === 'EVAL' && (
    warning.id?.includes('cytoscape-pdf-export') ||
    warning.id?.includes('core/dist/')
  )) return;
  warn(warning);
}

/** Copy public/demos/*.boxes → dist/demos/ so demo.html can fetch them. */
function copyDemoFiles() {
  return {
    name: 'copy-demo-files',
    closeBundle() {
      const src = resolve(__dirname, 'public/demos');
      const dst = resolve(__dirname, 'dist/demos');
      if (existsSync(src)) {
        cpSync(src, dst, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: 'public',
  base: './',
  resolve: {
    alias: {
      '/core/boxes-core.js': resolve(__dirname, '../core/dist/boxes-core.js')
    }
  },
  build: {
    // cytoscape-pdf-export bundles PDFKit with embedded fonts (~2.9 MB unminified).
    // It is loaded lazily so it doesn't affect initial page load. Raise the limit
    // to avoid the warning for this known-large third-party chunk.
    chunkSizeWarningLimit: 3500,
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        demo: resolve(__dirname, 'public/demo.html'),
      },
      onwarn: suppressKnownEvalWarnings,
    }
  },
  plugins: [copyDemoFiles()],
  server: {
    port: 3000
  }
});
