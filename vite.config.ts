import { readFileSync } from 'node:fs';
import { env } from 'node:process';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(env.GITHUB_SHA ?? 'dev'),
    __APP_RELEASE__: JSON.stringify(version.replace(/\.0$/, '')),
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
