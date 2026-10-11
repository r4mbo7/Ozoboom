import { execFileSync } from 'node:child_process';
import { argv, env, exit } from 'node:process';
import {
  dayStart,
  durationRows,
  durationsQuery,
  gameRows,
  gamesQuery,
  kpiReport,
  utcSince,
} from './kpi-report.ts';

const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const token = env.CLOUDFLARE_STATS_TOKEN;
if (!accountId || !token) {
  console.error(
    'pnpm kpi needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STATS_TOKEN in the environment: ' +
      'the account of the game, and an API token limited to Account Analytics Read on it.',
  );
  exit(1);
}

const day = argv[2];
const since = day === undefined ? releaseSince() : dayStart(day);
if (since === null) {
  console.error(`pnpm kpi takes a start day as YYYY-MM-DD, not "${String(day)}".`);
  exit(1);
}

const [games, durations] = await Promise.all([
  query(accountId, token, gamesQuery(since)),
  query(accountId, token, durationsQuery(since)),
]);
console.log(kpiReport(since, gameRows(games), durationRows(durations)));

function releaseSince(): string {
  const date = execFileSync(
    'git',
    ['log', 'origin/main', '--grep=^chore: release', '-1', '--format=%cI'],
    { encoding: 'utf8' },
  ).trim();
  if (date === '') throw new Error('No "chore: release" commit on origin/main');
  return utcSince(date);
}

async function query(account: string, apiToken: string, sql: string): Promise<unknown> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: sql },
  );
  if (!response.ok) {
    throw new Error(
      `Analytics Engine SQL API answered ${String(response.status)}: ${await response.text()}`,
    );
  }
  return response.json();
}
