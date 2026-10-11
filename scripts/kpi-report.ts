import type { GameDevice, GameMode, GameOutcome } from '../src/shared/stats.ts';

export interface GameRow {
  event: string;
  stage: string;
  mode: string;
  players: number;
  classes: string;
  device: string;
  version: string;
  outcome: string;
  tier: number;
  games: number;
}

export interface DurationRow {
  outcome: string;
  median: number;
}

const DATASET = 'ozoboom_games';
const TOP_COMPOSITIONS = 5;

const MODES: Record<GameMode, string> = {
  solo: 'Solo',
  local: 'Coop locale',
  online: 'En ligne',
};

const DEVICES: Record<GameDevice, string> = {
  keyboardMouse: 'Clavier et souris',
  gamepad: 'Manette',
  touch: 'Tactile',
};

const OUTCOMES: Record<GameOutcome, string> = {
  won: 'Gagnée',
  core: 'Noyau détruit',
  downed: 'Tous à terre',
  quit: 'Quittée',
  interrupted: 'Coupée',
};

const FINISHED: readonly string[] = ['won', 'core', 'downed'] satisfies GameOutcome[];

export function gamesQuery(since: string): string {
  return (
    'SELECT blob1 AS event, blob2 AS stage, blob3 AS mode, double1 AS players, ' +
    'blob4 AS classes, blob5 AS device, blob6 AS version, blob7 AS outcome, double2 AS tier, ' +
    `SUM(_sample_interval) AS games FROM ${DATASET} ` +
    `WHERE timestamp >= toDateTime('${since}') ` +
    'GROUP BY blob1, blob2, blob3, double1, blob4, blob5, blob6, blob7, double2 FORMAT JSON'
  );
}

export function durationsQuery(since: string): string {
  return (
    'SELECT blob7 AS outcome, quantileExactWeighted(0.5)(double3, _sample_interval) AS median ' +
    `FROM ${DATASET} WHERE blob1 = 'end' AND timestamp >= toDateTime('${since}') ` +
    'GROUP BY blob7 FORMAT JSON'
  );
}

type ApiRow = Record<string, string | number>;

function data(json: unknown): ApiRow[] {
  return (json as { data: ApiRow[] }).data;
}

export function gameRows(json: unknown): GameRow[] {
  return data(json).map((row) => ({
    event: String(row.event),
    stage: String(row.stage),
    mode: String(row.mode),
    players: Number(row.players),
    classes: String(row.classes),
    device: String(row.device),
    version: String(row.version),
    outcome: String(row.outcome),
    tier: Number(row.tier),
    games: Number(row.games),
  }));
}

export function durationRows(json: unknown): DurationRow[] {
  return data(json).map((row) => ({ outcome: String(row.outcome), median: Number(row.median) }));
}

export function dayStart(day: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day} 00:00:00` : null;
}

export function utcSince(isoDate: string): string {
  return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
}

export function kpiReport(since: string, rows: GameRow[], durations: DurationRow[]): string {
  const starts = rows.filter((row) => row.event === 'start');
  const ends = rows.filter((row) => row.event === 'end');
  const started = total(starts);
  const ended = total(ends);
  const finished = total(ends.filter((row) => FINISHED.includes(row.outcome)));
  const endsBy = countBy(ends, (row) => row.outcome);
  const medians = new Map(durations.map((row) => [row.outcome, row.median]));

  const classes = new Map<string, number>();
  for (const row of starts) {
    for (const id of new Set(row.classes.split('+'))) {
      classes.set(id, (classes.get(id) ?? 0) + row.games);
    }
  }

  const tiers = [...countBy(ends, (row) => `${row.stage}\t${String(row.tier)}`)]
    .map(([key, games]) => {
      const [stage = '', tier = ''] = key.split('\t');
      return { stage, tier: Number(tier), games };
    })
    .sort((a, b) => a.stage.localeCompare(b.stage) || a.tier - b.tier);
  const stageEnds = countBy(ends, (row) => row.stage);

  const sections = [
    `## KPI depuis le ${since} UTC`,
    section(
      'K1 - Scène des parties lancées',
      shares(['Scène'], ranked(countBy(starts, (row) => row.stage)).map(code), started),
    ),
    section(
      'K2 - Parties lancées et finies',
      table(
        ['Lancées', 'Finies', 'Part finie'],
        [[String(started), String(finished), share(finished, started)]],
        0,
      ),
    ),
    section(
      'K3 - Mode et nombre de joueurs',
      shares(
        ['Mode'],
        labelled(
          MODES,
          countBy(starts, (row) => row.mode),
        ),
        started,
      ),
      shares(
        ['Joueurs'],
        [...countBy(starts, (row) => String(row.players))].sort(
          ([a], [b]) => Number(a) - Number(b),
        ),
        started,
      ),
    ),
    section(
      'K4 - Classes et compositions',
      shares(['Classe', 'Parties où elle joue'], ranked(classes).map(code), started),
      shares(
        ['Composition'],
        ranked(countBy(starts, (row) => row.classes))
          .slice(0, TOP_COMPOSITIONS)
          .map(code),
        started,
      ),
    ),
    section(
      'K5 - Palier atteint par scène',
      table(
        ['Scène', 'Palier', 'Parties', 'Part de la scène'],
        tiers.map(({ stage, tier, games }) => [
          `\`${stage}\``,
          String(tier),
          String(games),
          share(games, stageEnds.get(stage) ?? 0),
        ]),
        1,
      ),
    ),
    section(
      'K6 - Durée médiane par issue',
      table(
        ['Issue', 'Parties', 'Durée médiane'],
        Object.entries(OUTCOMES).map(([outcome, label]) => {
          const games = endsBy.get(outcome) ?? 0;
          const median = medians.get(outcome);
          return [label, String(games), games > 0 && median !== undefined ? duration(median) : '-'];
        }),
        1,
      ),
    ),
    section('K7 - Issue des parties', shares(['Issue'], labelled(OUTCOMES, endsBy), ended)),
    section(
      'K8 - Périphérique',
      shares(
        ['Périphérique'],
        labelled(
          DEVICES,
          countBy(starts, (row) => row.device),
        ),
        started,
      ),
    ),
    section(
      'K9 - Version',
      shares(
        ['Version'],
        [...countBy(starts, (row) => row.version)].sort(([a], [b]) =>
          b.localeCompare(a, 'en', { numeric: true }),
        ),
        started,
      ),
    ),
  ];
  return sections.join('\n\n') + '\n';
}

function total(rows: GameRow[]): number {
  return rows.reduce((sum, row) => sum + row.games, 0);
}

function countBy(rows: GameRow[], key: (row: GameRow) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(key(row), (counts.get(key(row)) ?? 0) + row.games);
  }
  return counts;
}

function ranked(counts: Map<string, number>): [string, number][] {
  return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
}

function labelled(labels: Record<string, string>, counts: Map<string, number>): [string, number][] {
  return Object.entries(labels).map(([key, label]) => [label, counts.get(key) ?? 0]);
}

function code([key, games]: [string, number]): [string, number] {
  return [`\`${key}\``, games];
}

function section(title: string, ...tables: string[]): string {
  return [`### ${title}`, ...tables].join('\n\n');
}

function shares(headers: string[], counts: [string, number][], whole: number): string {
  const [first = '', second = 'Parties'] = headers;
  return table(
    [first, second, 'Part'],
    counts.map(([label, games]) => [label, String(games), share(games, whole)]),
    1,
  );
}

function table(headers: string[], rows: string[][], textColumns: number): string {
  if (rows.length === 0) return 'Aucune partie.';
  const align = headers.map((_, i) => (i < textColumns ? '---' : '---:'));
  return [headers, align, ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function share(part: number, whole: number): string {
  return whole === 0 ? '-' : `${String(Math.round((100 * part) / whole))} %`;
}

function duration(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = `${String(whole % 60)} s`;
  return minutes === 0 ? rest : `${String(minutes)} min ${rest}`;
}
