import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveIceServers, STUN_FALLBACK } from './ice';

const TURN_URL = 'https://turn.example.workers.dev';
const relay = [{ urls: 'turn:turn.cloudflare.com:3478', username: 'u', credential: 'c' }];

function answer(status: number, body: unknown): typeof fetch {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

describe('resolveIceServers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the ICE servers the Worker answers', async () => {
    const fetchFn = answer(200, { iceServers: relay });

    const servers = await resolveIceServers(TURN_URL, fetchFn);

    expect(servers).toEqual(relay);
    expect(fetchFn).toHaveBeenCalledWith(
      `${TURN_URL}/ice`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to STUN alone and warns on a 503', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const servers = await resolveIceServers(TURN_URL, answer(503, {}));

    expect(servers).toEqual(STUN_FALLBACK);
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to STUN alone on a malformed body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const servers = await resolveIceServers(TURN_URL, answer(200, { iceServers: 'nope' }));

    expect(servers).toEqual(STUN_FALLBACK);
  });

  it('falls back to STUN alone when the network fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = vi.fn(() => Promise.reject(new TypeError('offline')));

    const servers = await resolveIceServers(TURN_URL, fetchFn);

    expect(servers).toEqual(STUN_FALLBACK);
  });

  it('falls back to STUN alone after 3 seconds without an answer', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = vi.fn(() => new Promise<Response>(() => undefined));

    const pending = resolveIceServers(TURN_URL, fetchFn);
    await vi.advanceTimersByTimeAsync(3000);

    expect(await pending).toEqual(STUN_FALLBACK);
  });

  it('falls back to STUN alone, without a request, when the URL is unset', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = answer(200, { iceServers: relay });

    const servers = await resolveIceServers(undefined, fetchFn);

    expect(servers).toEqual(STUN_FALLBACK);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
