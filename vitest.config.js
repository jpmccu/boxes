import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['packages/*/tests/**/*.test.js', 'packages/*/tests/**/*.test.jsx']
  }
});
