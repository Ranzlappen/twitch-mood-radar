import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['js/**/__tests__/**/*.test.js', 'js/**/__tests__/*.test.js'],
  },
});
