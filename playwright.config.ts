import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Each checkout derives its own pair of ports from its path, so parallel checkouts never share a
// server. E2E_PORT and E2E_PEER_PORT force them.
const PATH_HASH = createHash('sha1')
  .update(import.meta.dirname)
  .digest();
const PORT = Number(process.env.E2E_PORT ?? 20_000 + 2 * (PATH_HASH.readUInt16BE(0) % 5000));
const URL = `http://localhost:${String(PORT)}/`;
// Local PeerJS broker for the online tests, so no test needs the Internet.
const PEER_PORT = Number(process.env.E2E_PEER_PORT ?? PORT + 1);
// The CI builds once with the broker address and shares dist/ between its shards.
const SERVE_ONLY = Boolean(process.env.E2E_PREBUILT);
// VS Code's snap leaks its GIO modules, built for an older glibc, and they crash WebKit's network process.
delete process.env.GIO_MODULE_DIR;

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
    // A trace's screenshots film every frame of a game: only the CI, which keeps reports, takes them.
    trace: { mode: 'retain-on-failure', screenshots: Boolean(process.env.CI) },
  },
  projects: [
    {
      name: 'chromium',
      // Every screen at every moment takes minutes: only `pnpm contrast`, with CONTRAST=1, runs it.
      // Left out rather than skipped, so that the CI shards split the tests that do run.
      testIgnore: process.env.CONTRAST === undefined ? 'contrast.spec.ts' : [],
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
  webServer: [
    {
      command: `${SERVE_ONLY ? '' : 'pnpm build && '}pnpm preview --port ${String(PORT)} --strictPort`,
      env: { VITE_PEER_SERVER: `localhost:${String(PEER_PORT)}` },
      url: URL,
      // Never reuse a server: one left running by another checkout would serve a stale build.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec peerjs --port ${String(PEER_PORT)}`,
      url: `http://localhost:${String(PEER_PORT)}/`,
      reuseExistingServer: false,
    },
  ],
});
