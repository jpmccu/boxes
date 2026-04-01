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

/**
 * cytoscape-pdf-export is distributed as a webpack bundle built with webpack's
 * eval devtool. When Rollup's CommonJS plugin converts it to ESM it renames
 * `exports` parameters to `exports$N`. The core build patches those renames by
 * injecting `var exports = exports$N;`. However, the web build then minifies
 * the pre-built core chunks and the minifier removes those `var` declarations
 * as dead code (because `exports` is only referenced inside eval() strings,
 * which are opaque to static analysis).
 *
 * This plugin runs with enforce:'post' so it executes after Vite's built-in
 * minification and re-injects the aliases that the minifier stripped.
 */
function fixWebpackEvalExports() {
  return {
    name: 'fix-webpack-eval-exports',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes('cytoscape-pdf-export')) return null;

      let fixed = code;
      // Arrow functions:  (..., exports$N, ...) => {
      fixed = fixed.replace(
        /\(([^)\n]*\bexports\$\d+\b[^)\n]*)\)\s*=>\s*\{/g,
        (match, params) => {
          const renamed = (params.match(/\bexports\$\d+\b/) ?? [])[0];
          if (!renamed) return match;
          return `(${params}) => {\nvar exports = ${renamed};`;
        }
      );
      // Regular anonymous functions:  function(..., exports$N, ...) {
      fixed = fixed.replace(
        /\bfunction\s*\(([^)\n]*\bexports\$\d+\b[^)\n]*)\)\s*\{/g,
        (match, params) => {
          const renamed = (params.match(/\bexports\$\d+\b/) ?? [])[0];
          if (!renamed) return match;
          return `function(${params}) {\nvar exports = ${renamed};`;
        }
      );

      return fixed !== code ? { code: fixed, map: null } : null;
    }
  };
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
  plugins: [fixWebpackEvalExports(), copyDemoFiles()],
  server: {
    port: 3000
  }
});
