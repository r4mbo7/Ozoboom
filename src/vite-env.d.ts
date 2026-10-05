// Commit SHA of the build, set by vite.config.ts from GITHUB_SHA; 'dev' outside CI.
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // Own PeerJS broker as host:port[/path]; unset means the public broker (ADR 0007).
  readonly VITE_PEER_SERVER?: string;
}
