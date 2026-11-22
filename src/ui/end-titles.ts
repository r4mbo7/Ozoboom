import { t, tn } from '../shared/i18n';
import type { PlayerState, PlayerTally } from '../sim/state';
import { formatNumber } from './format';

export interface PlayerTitle {
  title: string;
  // The count that earned it.
  proof: string;
}

interface Feat {
  count(tally: PlayerTally): number;
  title(count: number): string;
  proof(count: number): string;
}

// The rarest first: each goes to whoever leads it among those still without a title.
const FEATS: readonly Feat[] = [
  {
    count: (tally) => tally.bosses,
    title: (count) => tn(count, 'Chased off the boss', 'Chased off the bosses'),
    proof: (count) => tn(count, '{count} boss', '{count} bosses', { count: formatNumber(count) }),
  },
  {
    count: (tally) => tally.revives,
    title: () => t('Got the team back up'),
    proof: (count) =>
      tn(count, '{count} ally healed', '{count} allies healed', { count: formatNumber(count) }),
  },
  {
    count: (tally) => tally.badVibes,
    title: () => t('Chased off the most bad vibes'),
    proof: (count) =>
      tn(count, '{count} bad vibe', '{count} bad vibes', { count: formatNumber(count) }),
  },
  {
    count: (tally) => Math.round(tally.vibes),
    title: () => t('Picked up the most vibes'),
    proof: (count) => tn(count, '{count} vibe', '{count} vibes', { count: formatNumber(count) }),
  },
];

// Alone, nobody did the most of anything: a solo game has no title.
export function titlesOf(players: readonly PlayerState[]): (PlayerTitle | null)[] {
  const titles: (PlayerTitle | null)[] = players.map(() => null);
  if (players.length < 2) {
    return titles;
  }
  for (const feat of FEATS) {
    let leader = -1;
    let best = 0;
    players.forEach((player, index) => {
      const count = player.tally === undefined ? 0 : feat.count(player.tally);
      if (titles[index] === null && count > best) {
        leader = index;
        best = count;
      }
    });
    if (leader >= 0) {
      titles[leader] = { title: feat.title(best), proof: feat.proof(best) };
    }
  }
  return titles;
}
