import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    include: ['packages/*/tests/**/*.test.js', 'packages/*/tests/**/*.test.jsx']
  }
});
