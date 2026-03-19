import { defineConfig } from 'vite';
import { resolve } from 'path';

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
        main: resolve(__dirname, 'public/index.html')
      },
      onwarn: suppressKnownEvalWarnings,
    }
  },
  server: {
    port: 3000
  }
});
