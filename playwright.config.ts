import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const URL = `http://localhost:${String(PORT)}/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Without a GPU every game renders in software: one worker keeps CI frame rates comparable.
  ...(process.env.CI ? { workers: 1 } : {}),
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Headless Chromium has no GPU: SwiftShader gives the renderer a real WebGL context.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
