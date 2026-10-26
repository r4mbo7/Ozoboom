import { locale, t } from '../shared/i18n';
import { clamp01 } from '../shared/scalar';
import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from '../sim/state';

const formats = new Map<string, Intl.NumberFormat>();

// Built at the first use in each language: a module loads before the language is set.
function format(digits: number, value: number): string {
  const key = `${locale()}:${String(digits)}`;
  let numbers = formats.get(key);
  if (numbers === undefined) {
    numbers = new Intl.NumberFormat(locale(), {
      maximumFractionDigits: digits,
      numberingSystem: 'latn',
    });
    formats.set(key, numbers);
  }
  return numbers.format(value);
}

export function formatNumber(value: number): string {
  return format(0, value);
}

export function formatTenth(value: number): string {
  return format(1, value);
}

export function formatTempo(bpm: number): string {
  return `${formatTenth(bpm)}\u00a0BPM`;
}

export function formatSeconds(ticks: number): string {
  return `${formatTenth(ticks / TICK_RATE_HZ)}\u00a0s`;
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
  return clamp01(value / max);
}

export function formatPercent(fraction: number): string {
  return t('{percent}\u202f%', { percent: formatNumber(Math.round(fraction * 100)) });
}

export interface EndStat {
  label: string;
  value: string;
}

export function endStats(state: SimState): EndStat[] {
  return [
    { label: t('Phrases tenues'), value: formatNumber(state.stats.phrasesHeld) },
    { label: t('Temps'), value: formatDuration(state.tick) },
    { label: t('Bad vibes dissipées'), value: formatNumber(state.stats.kills) },
    { label: t('Vie de la scène'), value: formatPercent(ratio(state.core.hp, state.core.maxHp)) },
  ];
}
