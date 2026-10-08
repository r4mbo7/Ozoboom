export const TTL_SECONDS = 7200;
export const REFUSE_BYTES = 500e9;
export const CUTOFF_BYTES = 800e9;

const GAME_ORIGIN = 'https://r4mbo7.github.io';
const LOCAL_ORIGIN = /^http:\/\/localhost(:\d+)?$/;
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const TURN_API = 'https://rtc.live.cloudflare.com/v1/turn/keys';

export interface Env {
  CF_TURN_TOKEN_ID: string;
  CF_TURN_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ANALYTICS_REALTIME_TOKEN: string;
  USAGE: KVNamespace;
  RATE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface UsageRecord {
  month: string;
  bytes: number;
}

const monthOf = (now: Date): string => now.toISOString().slice(0, 7);

const isAllowedOrigin = (origin: string | null): origin is string =>
  origin !== null && (origin === GAME_ORIGIN || LOCAL_ORIGIN.test(origin));

async function relayIsCut(env: Env, month: string): Promise<boolean> {
  if ((await env.USAGE.get('cutoff')) === month) return true;
  const usage = await env.USAGE.get<UsageRecord>('usage', 'json');
  return usage?.month === month && usage.bytes >= REFUSE_BYTES;
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin)) return new Response('forbidden origin', { status: 403 });
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/ice') {
    return new Response('not found', { status: 404, headers: cors });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await env.RATE_LIMIT.limit({ key: ip })).success) {
    return new Response('too many requests', { status: 429, headers: cors });
  }
  if (await relayIsCut(env, monthOf(now))) {
    return new Response('relay disabled', { status: 503, headers: cors });
  }

  const upstream = await fetcher(
    `${TURN_API}/${env.CF_TURN_TOKEN_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    },
  );
  if (!upstream.ok) return new Response('upstream error', { status: 502, headers: cors });
  const { iceServers } = await upstream.json<{ iceServers: unknown }>();
  return Response.json({ iceServers }, { headers: cors });
}

interface AnalyticsBody {
  data?: {
    viewer: {
      accounts: { callsTurnUsageAdaptiveGroups: { sum: { egressBytes: number } }[] }[];
    };
  };
  errors?: unknown;
}

async function readEgressBytes(env: Env, fetcher: Fetcher, now: Date): Promise<number> {
  const response = await fetcher(`${CLOUDFLARE_API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_REALTIME_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `query ($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      callsTurnUsageAdaptiveGroups(limit: 1, filter: { datetimeMinute_geq: $start, datetimeMinute_lt: $end }) {
        sum { egressBytes }
      }
    }
  }
}`,
      variables: {
        accountTag: env.CF_ACCOUNT_ID,
        start: `${monthOf(now)}-01T00:00:00Z`,
        end: now.toISOString(),
      },
    }),
  });
  if (!response.ok) throw new Error(`TURN analytics request failed: ${String(response.status)}`);
  const body = await response.json<AnalyticsBody>();
  if (!body.data) throw new Error(`TURN analytics query failed: ${JSON.stringify(body.errors)}`);
  const groups = body.data.viewer.accounts[0]?.callsTurnUsageAdaptiveGroups ?? [];
  return groups.reduce((total, group) => total + group.sum.egressBytes, 0);
}

export async function handleScheduled(
  env: Env,
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<void> {
  const month = monthOf(now);
  const bytes = await readEgressBytes(env, fetcher, now);
  await env.USAGE.put('usage', JSON.stringify({ month, bytes } satisfies UsageRecord));
  if (bytes < CUTOFF_BYTES || (await env.USAGE.get('cutoff')) === month) return;

  const response = await fetcher(
    `${CLOUDFLARE_API}/accounts/${env.CF_ACCOUNT_ID}/calls/turn_keys/${env.CF_TURN_TOKEN_ID}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_ANALYTICS_REALTIME_TOKEN}` } },
  );
  if (!response.ok) throw new Error(`TURN key deletion failed: ${String(response.status)}`);
  await env.USAGE.put('cutoff', month);
}

export default {
  fetch: (request, env) => handleRequest(request, env),
  scheduled: (_controller, env, ctx) => {
    ctx.waitUntil(handleScheduled(env));
  },
} satisfies ExportedHandler<Env>;
