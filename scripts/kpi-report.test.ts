import { spawnSync } from 'node:child_process';
import { env as hostEnv, execPath } from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type DurationRow,
  type GameRow,
  dayStart,
  durationRows,
  durationsQuery,
  gameRows,
  gamesQuery,
  kpiReport,
  utcSince,
} from './kpi-report.ts';

const SINCE = '2026-10-09 21:24:53';

function start(fields: Partial<GameRow> = {}): GameRow {
  return {
    event: 'start',
    stage: 'soiree-v0',
    mode: 'solo',
    players: 1,
    classes: 'mage',
    device: 'keyboardMouse',
    version: '1.5',
    outcome: '',
    tier: 0,
    games: 1,
    ...fields,
  };
}

function end(fields: Partial<GameRow> = {}): GameRow {
  return start({ event: 'end', outcome: 'won', tier: 5, ...fields });
}

function report(games: GameRow[], durations: DurationRow[] = []): string {
  return kpiReport(SINCE, games, durations);
}

describe('KPI queries', () => {
  it('counts the games of the dataset since the date, weighted by their sample interval', () => {
    const sql = gamesQuery(SINCE);

    expect(sql).toBe(
      'SELECT blob1 AS event, blob2 AS stage, blob3 AS mode, double1 AS players, ' +
        'blob4 AS classes, blob5 AS device, blob6 AS version, blob7 AS outcome, double2 AS tier, ' +
        'SUM(_sample_interval) AS games FROM ozoboom_games ' +
        "WHERE timestamp >= toDateTime('2026-10-09 21:24:53') " +
        'GROUP BY blob1, blob2, blob3, double1, blob4, blob5, blob6, blob7, double2 FORMAT JSON',
    );
  });

  it('takes the weighted median of the seconds of the ends, by outcome', () => {
    const sql = durationsQuery(SINCE);

    expect(sql).toBe(
      'SELECT blob7 AS outcome, quantileExactWeighted(0.5)(double3, _sample_interval) AS median ' +
        "FROM ozoboom_games WHERE blob1 = 'end' AND timestamp >= toDateTime('2026-10-09 21:24:53') " +
        'GROUP BY blob7 FORMAT JSON',
    );
  });

  it('reads the numbers that the API quotes as strings', () => {
    const json = {
      meta: [],
      data: [{ ...start(), players: '2', tier: 0, games: '3' }],
      rows: 1,
    };

    const rows = gameRows(json);

    expect(rows).toEqual([start({ players: 2, games: 3 })]);
  });

  it('reads the medians', () => {
    const json = { meta: [], data: [{ outcome: 'won', median: '1085' }], rows: 1 };

    const rows = durationRows(json);

    expect(rows).toEqual([{ outcome: 'won', median: 1085 }]);
  });
});

describe('KPI period', () => {
  it('starts a given day at midnight UTC', () => {
    expect(dayStart('2026-10-01')).toBe('2026-10-01 00:00:00');
  });

  it('refuses a day that is not YYYY-MM-DD', () => {
    expect(dayStart('01/10/2026')).toBeNull();
    expect(dayStart("2026-10-01') OR 1=1 --")).toBeNull();
  });

  it('starts at the release commit, in UTC', () => {
    expect(utcSince('2026-10-09T23:24:53+02:00')).toBe('2026-10-09 21:24:53');
  });
});

describe('kpiReport', () => {
  it('names the period', () => {
    const text = report([]);

    expect(text).toContain('## KPI depuis le 2026-10-09 21:24:53 UTC');
  });

  it('shares the started games between the stages, most played first (K1)', () => {
    const games = [start({ stage: 'dome' }), start({ games: 3 }), end({ stage: 'dome', games: 9 })];

    const text = report(games);

    expect(text).toContain(
      [
        '### K1 - Scène des parties lancées',
        '',
        '| Scène | Parties | Part |',
        '| --- | ---: | ---: |',
        '| `soiree-v0` | 3 | 75 % |',
        '| `dome` | 1 | 25 % |',
      ].join('\n'),
    );
  });

  it('counts the started games and the share that were won or lost (K2)', () => {
    const games = [
      start({ games: 4 }),
      end({ outcome: 'won' }),
      end({ outcome: 'core' }),
      end({ outcome: 'downed' }),
      end({ outcome: 'quit' }),
    ];

    const text = report(games);

    expect(text).toContain(
      [
        '### K2 - Parties lancées et finies',
        '',
        '| Lancées | Finies | Part finie |',
        '| ---: | ---: | ---: |',
        '| 4 | 3 | 75 % |',
      ].join('\n'),
    );
  });

  it('splits the started games by mode, every mode shown, and by player count (K3)', () => {
    const games = [start({ games: 3 }), start({ mode: 'online', players: 3, classes: 'a+b+c' })];

    const text = report(games);

    expect(text).toContain(
      [
        '### K3 - Mode et nombre de joueurs',
        '',
        '| Mode | Parties | Part |',
        '| --- | ---: | ---: |',
        '| Solo | 3 | 75 % |',
        '| Coop locale | 0 | 0 % |',
        '| En ligne | 1 | 25 % |',
        '',
        '| Joueurs | Parties | Part |',
        '| --- | ---: | ---: |',
        '| 1 | 3 | 75 % |',
        '| 3 | 1 | 25 % |',
      ].join('\n'),
    );
  });

  it('shares the games where each class plays, and the most played compositions (K4)', () => {
    const games = [
      start({ classes: 'healer+mage', players: 2, games: 2 }),
      start({ classes: 'mage+tank', players: 2 }),
      start({ classes: 'tank' }),
    ];

    const text = report(games);

    expect(text).toContain(
      [
        '### K4 - Classes et compositions',
        '',
        '| Classe | Parties où elle joue | Part |',
        '| --- | ---: | ---: |',
        '| `mage` | 3 | 75 % |',
        '| `healer` | 2 | 50 % |',
        '| `tank` | 2 | 50 % |',
        '',
        '| Composition | Parties | Part |',
        '| --- | ---: | ---: |',
        '| `healer+mage` | 2 | 50 % |',
        '| `mage+tank` | 1 | 25 % |',
        '| `tank` | 1 | 25 % |',
      ].join('\n'),
    );
  });

  it('keeps the five most played compositions', () => {
    const games = ['a', 'b', 'c', 'd', 'e', 'f'].map((classes, i) =>
      start({ classes, games: 6 - i }),
    );

    const text = report(games);

    const compositions = text.split('| Composition |')[1]?.split('###')[0];
    expect(compositions).toContain('| `e` | 2 |');
    expect(compositions).not.toContain('| `f` |');
  });

  it('spreads the tiers reached within each stage (K5)', () => {
    const games = [
      start({ games: 9 }),
      end({ tier: 2, games: 3 }),
      end({ tier: 5 }),
      end({ stage: 'dome', tier: 1 }),
    ];

    const text = report(games);

    expect(text).toContain(
      [
        '### K5 - Palier atteint par scène',
        '',
        '| Scène | Palier | Parties | Part de la scène |',
        '| --- | ---: | ---: | ---: |',
        '| `dome` | 1 | 1 | 100 % |',
        '| `soiree-v0` | 2 | 3 | 75 % |',
        '| `soiree-v0` | 5 | 1 | 25 % |',
      ].join('\n'),
    );
  });

  it('gives the median duration of each outcome, a dash where none ended so (K6)', () => {
    const games = [end({ outcome: 'won', games: 2 }), end({ outcome: 'quit' })];
    const durations = [
      { outcome: 'won', median: 1085 },
      { outcome: 'quit', median: 42 },
    ];

    const text = report(games, durations);

    expect(text).toContain(
      [
        '### K6 - Durée médiane par issue',
        '',
        '| Issue | Parties | Durée médiane |',
        '| --- | ---: | ---: |',
        '| Gagnée | 2 | 18 min 5 s |',
        '| Noyau détruit | 0 | - |',
        '| Tous à terre | 0 | - |',
        '| Quittée | 1 | 42 s |',
        '| Coupée | 0 | - |',
      ].join('\n'),
    );
  });

  it('shares the ended games between the five outcomes (K7)', () => {
    const games = [
      start({ games: 7 }),
      end({ outcome: 'core', games: 3 }),
      end({ outcome: 'interrupted' }),
    ];

    const text = report(games);

    expect(text).toContain(
      [
        '### K7 - Issue des parties',
        '',
        '| Issue | Parties | Part |',
        '| --- | ---: | ---: |',
        '| Gagnée | 0 | 0 % |',
        '| Noyau détruit | 3 | 75 % |',
        '| Tous à terre | 0 | 0 % |',
        '| Quittée | 0 | 0 % |',
        '| Coupée | 1 | 25 % |',
      ].join('\n'),
    );
  });

  it('splits the started games by device (K8)', () => {
    const games = [start({ device: 'gamepad', games: 2 }), start({ device: 'touch' })];

    const text = report(games);

    expect(text).toContain(
      [
        '### K8 - Périphérique',
        '',
        '| Périphérique | Parties | Part |',
        '| --- | ---: | ---: |',
        '| Clavier et souris | 0 | 0 % |',
        '| Manette | 2 | 67 % |',
        '| Tactile | 1 | 33 % |',
      ].join('\n'),
    );
  });

  it('counts the started games of each release, latest first (K9)', () => {
    const games = [start({ version: '1.10' }), start({ version: '1.9', games: 3 })];

    const text = report(games);

    expect(text).toContain(
      [
        '### K9 - Version',
        '',
        '| Version | Parties | Part |',
        '| --- | ---: | ---: |',
        '| 1.10 | 1 | 25 % |',
        '| 1.9 | 3 | 75 % |',
      ].join('\n'),
    );
  });

  it('shows a dash for shares and says so for lists when no game started', () => {
    const text = report([]);

    expect(text).toContain('| 0 | 0 | - |');
    expect(text).toContain('| Solo | 0 | - |');
    expect(text).toContain('### K9 - Version\n\nAucune partie.');
  });
});

describe('pnpm kpi', () => {
  it('stops with a clear message when the Cloudflare credentials are missing', () => {
    const script = fileURLToPath(new URL('kpi.ts', import.meta.url));
    const env = { PATH: hostEnv.PATH };

    const run = spawnSync(execPath, [script], { env, encoding: 'utf8' });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STATS_TOKEN');
    expect(run.stdout).toBe('');
  });
});
