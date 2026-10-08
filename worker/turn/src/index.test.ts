import { describe, expect, it, vi } from 'vitest';
import { handleRequest, handleScheduled, type Env, type Fetcher } from './index';

const NOW = new Date('2026-10-15T12:00:00Z');
const ICE = [{ urls: ['stun:stun.cloudflare.com:3478'] }];

const usage = (gb: number, month = '2026-10', minutesAgo = 5) => ({
  usage: JSON.stringify({
    month,
    bytes: gb * 1e9,
    at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
  }),
});

function makeEnv(initial: Record<string, string> = usage(0), allowed = true): Env {
  const store = new Map(Object.entries(initial));
  return {
    CF_TURN_TOKEN_ID: 'key-id',
    CF_TURN_API_TOKEN: 'key-token',
    CF_ACCOUNT_ID: 'account',
    CF_ANALYTICS_REALTIME_TOKEN: 'account-token',
    USAGE: {
      get: (key: string, type?: string) => {
        const value = store.get(key) ?? null;
        return Promise.resolve(type === 'json' && value !== null ? JSON.parse(value) : value);
      },
      put: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    } as unknown as KVNamespace,
    RATE_LIMIT: { limit: () => Promise.resolve({ success: allowed }) },
  };
}

const ask = (env: Env, fetcher: Fetcher, origin: string | null = 'https://r4mbo7.github.io') =>
  handleRequest(
    new Request('https://turn.example/ice', {
      method: 'POST',
      headers: origin === null ? {} : { Origin: origin },
    }),
    env,
    fetcher,
    NOW,
  );

const iceFetcher = () => vi.fn<Fetcher>(() => Promise.resolve(Response.json({ iceServers: ICE })));

const analyticsResponse = (gb: number) =>
  Response.json({
    data: {
      viewer: {
        accounts: [{ callsTurnUsageAdaptiveGroups: [{ sum: { egressBytes: gb * 1e9 } }] }],
      },
    },
  });

const cronFetcher = (gb: number) =>
  vi.fn<Fetcher>((url) =>
    Promise.resolve(
      url.endsWith('/graphql') ? analyticsResponse(gb) : new Response('{}', { status: 200 }),
    ),
  );

describe('POST /ice', () => {
  it('hands out the Cloudflare ice servers with a 2 hour ttl', async () => {
    const fetcher = iceFetcher();

    const response = await ask(makeEnv(), fetcher);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ iceServers: ICE });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://r4mbo7.github.io');
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers',
    );
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer key-token' });
    expect(JSON.parse(init?.body as string)).toEqual({ ttl: 7200 });
  });

  it('accepts a localhost origin on any port', async () => {
    const response = await ask(makeEnv(), iceFetcher(), 'http://localhost:5173');

    expect(response.status).toBe(200);
  });

  it.each(['https://evil.example', 'http://localhost.evil.example', null])(
    'refuses origin %s without calling Cloudflare',
    async (origin) => {
      const fetcher = iceFetcher();

      const response = await ask(makeEnv(), fetcher, origin);

      expect(response.status).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('answers 429 when the IP is over its rate limit', async () => {
    const fetcher = iceFetcher();

    const response = await ask(makeEnv({}, false), fetcher);

    expect(response.status).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers 503 from 500 GB of monthly egress', async () => {
    const fetcher = iceFetcher();

    const response = await ask(makeEnv(usage(500)), fetcher);

    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps serving below 500 GB and ignores last month usage', async () => {
    expect((await ask(makeEnv(usage(499)), iceFetcher())).status).toBe(200);
    expect((await ask(makeEnv(usage(900, '2026-09')), iceFetcher())).status).toBe(200);
  });

  it('answers 503 once the key was cut this month', async () => {
    const response = await ask(makeEnv({ ...usage(0), cutoff: '2026-10' }), iceFetcher());

    expect(response.status).toBe(503);
  });

  it.each([
    ['no usage was ever measured', {}],
    ['the last measure is over 30 minutes old', usage(0, '2026-10', 31)],
  ])('answers 503 when %s', async (_case, initial) => {
    const fetcher = iceFetcher();

    const response = await ask(makeEnv(initial), fetcher);

    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers 502 when Cloudflare refuses', async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(new Response('no', { status: 401 })));

    expect((await ask(makeEnv(), fetcher)).status).toBe(502);
  });
});

describe('scheduled usage check', () => {
  it('stores the month egress read from GraphQL since the 1st UTC', async () => {
    const env = makeEnv();
    const fetcher = cronFetcher(120);

    await handleScheduled(env, fetcher, NOW);

    expect(await env.USAGE.get('usage', 'json')).toEqual({
      month: '2026-10',
      bytes: 120e9,
      at: NOW.toISOString(),
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      variables: { accountTag: 'account', start: '2026-10-01T00:00:00Z' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deletes the TURN key from 800 GB and notes it in KV', async () => {
    const env = makeEnv();
    const fetcher = cronFetcher(800);

    await handleScheduled(env, fetcher, NOW);

    const [url, init] = fetcher.mock.calls[1] ?? [];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account/calls/turn_keys/key-id',
    );
    expect(init?.method).toBe('DELETE');
    expect(await env.USAGE.get('cutoff')).toBe('2026-10');
  });

  it('deletes the key only once per month', async () => {
    const env = makeEnv();
    const fetcher = cronFetcher(900);

    await handleScheduled(env, fetcher, NOW);
    await handleScheduled(env, fetcher, NOW);

    const deletions = fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(deletions).toHaveLength(1);
  });

  it('does not delete below 800 GB', async () => {
    const fetcher = cronFetcher(799);

    await handleScheduled(makeEnv(), fetcher, NOW);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('leaves the cutoff unset when the deletion fails so the next run retries', async () => {
    const env = makeEnv();
    const failing = vi.fn<Fetcher>((url) =>
      Promise.resolve(
        url.endsWith('/graphql') ? analyticsResponse(900) : new Response('no', { status: 500 }),
      ),
    );

    await expect(handleScheduled(env, failing, NOW)).rejects.toThrow('deletion failed');
    expect(await env.USAGE.get('cutoff')).toBeNull();
  });
});
