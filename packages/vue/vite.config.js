import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

function suppressKnownEvalWarnings(warning, warn) {
  if (warning.code === 'EVAL' && (
    warning.id?.includes('cytoscape-pdf-export') ||
    warning.id?.includes('core/dist/')
  )) return;
  warn(warning);
}

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 3500,
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'BoxesVue',
      fileName: (format) => format === 'es' ? 'boxes-vue.js' : 'boxes-vue.umd.js',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      },
      onwarn: suppressKnownEvalWarnings,
    }
  }
});
