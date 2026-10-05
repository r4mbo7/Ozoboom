import { defineConfig, devices } from '@playwright/test';

// Parallel checkouts each pick their own port: E2E_PORT=4201 pnpm exec playwright test
const PORT = Number(process.env.E2E_PORT ?? 4173);
const URL = `http://localhost:${String(PORT)}/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Without a GPU every game renders in software and takes several cores: one worker keeps CI frame
  // rates comparable, and four keep a many-core laptop from starving its own browsers to a timeout.
  workers: process.env.CI ? 1 : 4,
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
    // The lockstep needs one fingerprint in every engine: only the determinism spec runs there.
    { name: 'firefox', testMatch: 'determinism.spec.ts', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: 'determinism.spec.ts', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: URL,
    // Never reuse a server: one left running by another checkout would serve a stale build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
