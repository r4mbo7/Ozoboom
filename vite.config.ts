import { globSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pages = ['index.html', ...globSync('dev/*.html')];

export default defineConfig({
  base: './',
  build: {
    target: 'es2023',
    sourcemap: true,
    rollupOptions: {
      input: pages,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
