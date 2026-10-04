import { globSync } from 'node:fs';
import { env } from 'node:process';
import { defineConfig } from 'vitest/config';

const pages = ['index.html', ...globSync('dev/*.html')];

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(env.GITHUB_SHA ?? 'dev'),
  },
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
