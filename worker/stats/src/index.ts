import { parseGameEvent } from '../../../src/shared/stats';

const GAME_ORIGIN = 'https://r4mbo7.github.io';
const LOCAL_ORIGIN = /^http:\/\/localhost(:\d+)?$/;

export interface Env {
  GAMES: AnalyticsEngineDataset;
  RATE_LIMIT: RateLimit;
}

const isAllowedOrigin = (origin: string | null): boolean =>
  origin !== null && (origin === GAME_ORIGIN || LOCAL_ORIGIN.test(origin));

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get('Origin'))) {
    return new Response('forbidden origin', { status: 403 });
  }
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/event') {
    return new Response('not found', { status: 404 });
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await env.RATE_LIMIT.limit({ key: ip })).success) {
    return new Response('too many requests', { status: 429 });
  }
  const game = parseGameEvent(await request.text());
  if (game === null) return new Response('invalid event', { status: 400 });

  const end = game.event === 'end' ? game : null;
  env.GAMES.writeDataPoint({
    indexes: [game.stage],
    blobs: [
      game.event,
      game.stage,
      game.mode,
      game.classes,
      game.device,
      game.version,
      end?.outcome ?? '',
    ],
    doubles: [game.players, end?.tier ?? 0, end?.seconds ?? 0],
  });
  return new Response(null, { status: 204 });
}

export default {
  fetch: (request, env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>;
