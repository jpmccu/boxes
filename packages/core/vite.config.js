import { defineConfig } from 'vite';
import { resolve } from 'path';

function suppressKnownEvalWarnings(warning, warn) {
  // cytoscape-pdf-export bundles PDFKit via webpack's eval devtool.
  // These eval() calls are in a third-party bundle and are not a concern for us.
  if (warning.code === 'EVAL' && warning.id?.includes('cytoscape-pdf-export')) return;
  warn(warning);
}

/**
 * cytoscape-pdf-export is distributed as a webpack bundle built with webpack's
 * eval devtool (development mode). When Rollup's CommonJS plugin converts it
 * to ESM, it renames `exports` parameters to `exports$N` to avoid shadowing,
 * but the eval'd module strings still reference `exports` by its original name,
 * causing a ReferenceError at runtime.
 *
 * This plugin post-processes the generated PDF chunk and injects
 *   var exports = exports$N;
 * at the start of every function (arrow or regular) where the rename occurred,
 * aliasing the parameter back to the name the eval strings expect.
 */
function fixWebpackEvalExports() {
  return {
    name: 'fix-webpack-eval-exports',
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes('cytoscape-pdf-export')) return null;

      let fixed = code;
      // Arrow functions:  (..., exports$N, ...) => {
      fixed = fixed.replace(
        /\(([^)\n]*\bexports\$\d+\b[^)\n]*)\)\s*=>\s*\{/g,
        (match, params) => {
          const renamed = params.match(/\bexports\$\d+\b/)[0];
          return `(${params}) => {\nvar exports = ${renamed};`;
        }
      );
      // Regular anonymous functions:  function(..., exports$N, ...) {
      fixed = fixed.replace(
        /\bfunction\s*\(([^)\n]*\bexports\$\d+\b[^)\n]*)\)\s*\{/g,
        (match, params) => {
          const renamed = params.match(/\bexports\$\d+\b/)[0];
          return `function(${params}) {\nvar exports = ${renamed};`;
        }
      );

      return fixed !== code ? { code: fixed, map: null } : null;
    }
  };
}

export default defineConfig({
  plugins: [fixWebpackEvalExports()],
  build: {
    // cytoscape-pdf-export (PDFKit) is split into a separate async chunk but is
    // inherently large due to embedded font data. Raise the limit accordingly.
    chunkSizeWarningLimit: 3500,
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'BoxesCore',
      fileName: (format) => format === 'es' ? 'boxes-core.js' : 'boxes-core.umd.js',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      },
      onwarn: suppressKnownEvalWarnings,
    }
  }
});
