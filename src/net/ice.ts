export const STUN_FALLBACK: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const TURN_TIMEOUT_MS = 3000;

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
          reject(new Error(`no answer within ${String(TURN_TIMEOUT_MS)} ms`));
        });
      }),
    ]);
    if (!response.ok) {
      throw new Error(`answered ${String(response.status)}`);
    }
    const body = (await response.json()) as { iceServers?: unknown };
    if (!Array.isArray(body.iceServers) || body.iceServers.length === 0) {
      throw new Error('malformed answer');
    }
    return body.iceServers as RTCIceServer[];
  } finally {
    clearTimeout(timer);
  }
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
    console.warn('TURN Worker unavailable, STUN only:', error);
    return STUN_FALLBACK;
  }
}
