// Commit SHA of the build, set by vite.config.ts from GITHUB_SHA; 'dev' outside CI.
declare const __APP_VERSION__: string;
// Release shown to players, package.json's version without its patch: '0.3'.
declare const __APP_RELEASE__: string;

interface ImportMetaEnv {
  // Own PeerJS broker as host:port[/path]; unset means the public broker (ADR 0007).
  readonly VITE_PEER_SERVER?: string;
  // Base URL of the TURN Worker (ADR 0011); unset means STUN only.
  readonly VITE_TURN_URL?: string;
}
