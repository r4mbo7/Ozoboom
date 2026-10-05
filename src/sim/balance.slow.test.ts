import { writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { BALANCE_SEEDS, balanceTable, playTeam, teamsOf, type TeamResult } from './balance';

const CLASS_IDS = CONTENT.classes.map((definition) => definition.id);
const REFERENCE = 'mage';
const SEEDS = BALANCE_SEEDS.slice(0, Number(env.BALANCE_SEED_COUNT ?? BALANCE_SEEDS.length));
// Known gap: several care add their stage repairs, which the roles keep high (playability.test.ts),
// so a team of care holds about one phrase more than the care alone.
const TEAM_GAP: Readonly<Record<string, number>> = { healer: 1.2 };
const gap = (a: number, b: number) => Math.round(Math.abs(a - b) * 10) / 10;

// The whole matrix takes minutes: `pnpm balance` runs it and writes the table to balance.md,
// `pnpm test` skips it. BALANCE_QUICK=1 plays only the teams the targets below look at.
describe.skipIf(env.BALANCE === undefined)('team balance on the real set', () => {
  const started = Date.now();
  const teams = teamsOf(CLASS_IDS, 4).filter(
    (team) =>
      env.BALANCE_QUICK === undefined ||
      new Set(team).size === 1 ||
      (team.length === 3 && new Set(team).size === 3),
  );
  const results: TeamResult[] = teams.map((team) => playTeam(team, SEEDS));
  const phrasesOf = (team: readonly string[]) =>
    results.find((result) => result.team.join() === team.join())?.phrases ?? NaN;

  it('prints the table', () => {
    const table = `${balanceTable(results, SEEDS.length)}\n\n${String((Date.now() - started) / 1000)} s\n`;
    writeFileSync(env.BALANCE_OUT ?? 'balance.md', table);
    expect(results.length).toBeGreaterThan(0);
  });

  it.each(CLASS_IDS)(
    'holds as much with a team of %s as with one alone, give or take one',
    (id) => {
      for (const size of [2, 3, 4]) {
        const team = Array.from({ length: size }, () => id);
        expect(gap(phrasesOf(team), phrasesOf([id])), team.join(' + ')).toBeLessThanOrEqual(
          TEAM_GAP[id] ?? 1,
        );
      }
    },
  );

  it.each(CLASS_IDS)('holds with %s alone at least as much as the VJ minus a phrase', (id) => {
    expect(phrasesOf([id])).toBeGreaterThanOrEqual(phrasesOf([REFERENCE]) - 1);
  });

  it('holds with three different classes at least as much as with three VJ', () => {
    expect(phrasesOf(CLASS_IDS)).toBeGreaterThanOrEqual(
      phrasesOf([REFERENCE, REFERENCE, REFERENCE]),
    );
  });
});
