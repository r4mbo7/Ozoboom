import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from '../sim/state';

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return integer.format(value);
}

export function formatDuration(ticks: number): string {
  const totalSeconds = Math.floor(Math.max(0, ticks) / TICK_RATE_HZ);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function ratio(value: number, max: number): number {
  if (!(max > 0)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
}

export function formatPercent(fraction: number): string {
  return `${formatNumber(Math.round(fraction * 100))}\u202f%`;
}

export interface EndStat {
  label: string;
  value: string;
}

export function endStats(state: SimState): EndStat[] {
  return [
    { label: 'Phrases tenues', value: formatNumber(state.stats.phrasesHeld) },
    { label: 'Temps', value: formatDuration(state.tick) },
    { label: 'Bad vibes dissipées', value: formatNumber(state.stats.kills) },
    { label: 'Volume de la scène', value: formatPercent(ratio(state.core.hp, state.core.maxHp)) },
  ];
}
