import { isRecord } from '../shared/guards';

export const STUN_FALLBACK: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const TURN_TIMEOUT_MS = 3000;

class RelayUnavailable extends Error {}

async function fetchRelay(fetchFn: typeof fetch, turnUrl: string): Promise<RTCIceServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TURN_TIMEOUT_MS);
  try {
    const response = await Promise.race([
      fetchFn(`${turnUrl}/ice`, { method: 'POST', signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new RelayUnavailable(`no answer within ${String(TURN_TIMEOUT_MS)} ms`));
        });
      }),
    ]);
    if (!response.ok) {
      throw new RelayUnavailable(`answered ${String(response.status)}`);
    }
    const body: unknown = await response.json();
    const servers = isRecord(body) ? body.iceServers : undefined;
    if (!Array.isArray(servers) || servers.length === 0 || !servers.every(isIceServer)) {
      throw new RelayUnavailable('malformed answer');
    }
    return servers;
  } finally {
    clearTimeout(timer);
  }
}

function isIceServer(value: unknown): value is RTCIceServer {
  return (
    isRecord(value) &&
    (typeof value.urls === 'string' ||
      (Array.isArray(value.urls) && value.urls.every((url) => typeof url === 'string'))) &&
    (value.username === undefined || typeof value.username === 'string') &&
    (value.credential === undefined || typeof value.credential === 'string')
  );
}

// PeerJS's own default ICE servers include dead TURN relays: always pass an explicit list.
export async function resolveIceServers(
  turnUrl: string | undefined,
  fetchFn: typeof fetch,
): Promise<RTCIceServer[]> {
  if (turnUrl === undefined || turnUrl === '') {
    console.warn('VITE_TURN_URL is unset: no TURN relay, STUN only');
    return STUN_FALLBACK;
  }
  try {
    return await fetchRelay(fetchFn, turnUrl);
  } catch (error) {
    const unreachable =
      error instanceof RelayUnavailable ||
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      error instanceof DOMException;
    if (!unreachable) {
      throw error;
    }
    console.warn('TURN Worker unavailable, STUN only:', error);
    return STUN_FALLBACK;
  }
}
