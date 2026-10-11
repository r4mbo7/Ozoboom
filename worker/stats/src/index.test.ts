import { describe, expect, it, vi } from 'vitest';
import { handleRequest, type Env } from './index';

const START = {
  event: 'start',
  stage: 'dome',
  mode: 'local',
  players: 2,
  classes: 'tank+healer',
  device: 'gamepad',
  version: '1.5',
};

const END = { ...START, event: 'end', outcome: 'won', tier: 3, seconds: 412 };

function makeEnv(allowed = true) {
  const writeDataPoint = vi.fn<AnalyticsEngineDataset['writeDataPoint']>();
  const limit = vi.fn<RateLimit['limit']>(() => Promise.resolve({ success: allowed }));
  const env: Env = { GAMES: { writeDataPoint }, RATE_LIMIT: { limit } };
  return { env, writeDataPoint, limit };
}

interface Target {
  origin?: string | null;
  method?: string;
  path?: string;
}

const send = (
  env: Env,
  body: string,
  { origin = 'https://r4mbo7.github.io', method = 'POST', path = '/event' }: Target = {},
) =>
  handleRequest(
    new Request(`https://stats.example${path}`, {
      method,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'CF-Connecting-IP': '203.0.113.7',
        ...(origin === null ? {} : { Origin: origin }),
      },
      ...(method === 'POST' ? { body } : {}),
    }),
    env,
  );

describe('POST /event', () => {
  it('writes a game end as one data point indexed by stage', async () => {
    const { env, writeDataPoint } = makeEnv();

    const response = await send(env, JSON.stringify(END));

    expect(response.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledExactlyOnceWith({
      indexes: ['dome'],
      blobs: ['end', 'dome', 'local', 'tank+healer', 'gamepad', '1.5', 'won'],
      doubles: [2, 3, 412],
    });
  });

  it('writes a game start with an empty outcome and zero tier and seconds', async () => {
    const { env, writeDataPoint } = makeEnv();

    const response = await send(env, JSON.stringify(START), { origin: 'http://localhost:5173' });

    expect(response.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledExactlyOnceWith({
      indexes: ['dome'],
      blobs: ['start', 'dome', 'local', 'tank+healer', 'gamepad', '1.5', ''],
      doubles: [2, 0, 0],
    });
  });

  it.each([
    ['not JSON', 'start'],
    ['an unknown field', JSON.stringify({ ...START, ip: '203.0.113.7' })],
    ['a missing field', JSON.stringify({ ...END, seconds: undefined })],
  ])('answers 400 and writes nothing for %s', async (_case, body) => {
    const { env, writeDataPoint } = makeEnv();

    const response = await send(env, body);

    expect(response.status).toBe(400);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it.each(['https://evil.example', 'http://localhost.evil.example', null])(
    'answers 403 to origin %s without spending the rate limit',
    async (origin) => {
      const { env, writeDataPoint, limit } = makeEnv();

      const response = await send(env, JSON.stringify(START), { origin });

      expect(response.status).toBe(403);
      expect(limit).not.toHaveBeenCalled();
      expect(writeDataPoint).not.toHaveBeenCalled();
    },
  );

  it('answers 429 over the rate limit of the IP, which is never written', async () => {
    const { env, writeDataPoint, limit } = makeEnv(false);

    const response = await send(env, JSON.stringify(START));

    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/event'],
    ['POST', '/'],
  ])('answers 404 to %s %s', async (method, path) => {
    const { env, writeDataPoint } = makeEnv();

    const response = await send(env, JSON.stringify(START), { method, path });

    expect(response.status).toBe(404);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
