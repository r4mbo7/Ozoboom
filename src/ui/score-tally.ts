import { t, tn } from '../shared/i18n';
import { DEFAULT_BPM, TICK_RATE_HZ, beatPeriodMs } from '../shared/tempo';
import type { ScoreBreakdown, ScoreTerm } from '../sim/score';
import { formatDuration, formatFactor, formatNumber, formatPercent } from './format';

// A line of the ticket. `count` is the part of `label` drawn bold.
export interface TicketLine {
  count: string;
  label: string;
  price: string;
  points: string;
  // The score once this line has landed.
  score: number;
}

export interface Tally {
  lines: TicketLine[];
  total: number;
}

// One line lands per beat of the night.
export const TALLY_STEP_MS = beatPeriodMs(DEFAULT_BPM);

export function tallyOf(breakdown: ScoreBreakdown): Tally {
  const lines: TicketLine[] = [];
  let score = 0;
  for (const term of breakdown.terms) {
    score += term.points;
    lines.push({
      ...termWords(term),
      points: formatNumber(term.points),
      score,
    });
  }
  const { volume, challenges } = breakdown;
  if (volume.level > 0) {
    const count = formatNumber(volume.level);
    const label = t('Volume {level}', { level: count });
    const factor = formatFactor(volume.mul);
    score += volume.points;
    lines.push({
      count,
      label,
      price: '',
      points: factor,
      score,
    });
  }
  if (challenges.count > 0) {
    const count = formatNumber(challenges.count);
    score += challenges.bonus;
    lines.push({
      count,
      label: tn(challenges.count, '{count} défi relevé', '{count} défis relevés', { count }),
      price: t('+{percent} par défi', { percent: formatPercent(challenges.rate) }),
      points: `+${formatNumber(challenges.bonus)}`,
      score,
    });
  }
  return { lines, total: breakdown.total };
}

// The score the ticket shows `elapsed` ms into the count: each line counts up over its beat.
export function shownScore(tally: Tally, elapsed: number): number {
  const step = Math.floor(elapsed / TALLY_STEP_MS);
  const landed = tally.lines[step - 1]?.score ?? 0;
  const next = tally.lines[step];
  if (next === undefined) {
    return step <= 0 ? 0 : tally.total;
  }
  const progress = elapsed / TALLY_STEP_MS - step;
  return landed + Math.floor((next.score - landed) * progress);
}

// The count ends one beat after its last line landed: the total rests, then the ticket folds.
export function tallyMs(tally: Tally): number {
  return (tally.lines.length + 1) * TALLY_STEP_MS;
}

function termWords(term: ScoreTerm): Omit<TicketLine, 'points' | 'score'> {
  const count = formatNumber(term.count);
  const price = t('× {points}', { points: formatNumber(term.price) });
  switch (term.source) {
    case 'phrases':
      return {
        count,
        label: tn(term.count, '{count} phrase tenue', '{count} phrases tenues', { count }),
        price,
      };
    case 'seconds': {
      const duration = formatDuration(term.count * TICK_RATE_HZ);
      return {
        count: duration,
        label: t('{duration} de son', { duration }),
        price: t('× {points}/s', { points: formatNumber(term.price) }),
      };
    }
    case 'kills':
      return {
        count,
        label: tn(term.count, '{count} bad vibe dissipée', '{count} bad vibes dissipées', {
          count,
        }),
        price,
      };
    case 'stages':
      return {
        count,
        label: tn(term.count, '{count} scène tenue', '{count} scènes tenues', { count }),
        price,
      };
    case 'calledBosses':
      return {
        count,
        label: tn(term.count, '{count} boss appelé abattu', '{count} boss appelés abattus', {
          count,
        }),
        price,
      };
    case 'core': {
      const percent = formatPercent(term.count / 100);
      return {
        count: percent,
        label: t('Vie de la scène {percent}', { percent }),
        price,
      };
    }
  }
}
