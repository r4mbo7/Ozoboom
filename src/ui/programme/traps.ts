import { TRAPS } from '../../data/traps';
import type { TrapDefinition, TrapEffect } from '../../data/types';
import { t } from '../../shared/i18n';
import { BEATS_PER_BAR, TICKS_PER_BEAT } from '../../shared/tempo';
import { formatHundredth } from '../format';
import { trapIcon } from '../icons';
import { figureRows } from './figure-rows';
import type { ProgrammeEntry, ProgrammeTab } from './types';

interface TrapFigures {
  // On every beat: a beam hits on every tick it touches, at the main stage's tempo.
  readonly damage?: number;
  readonly range: number;
  readonly heal?: number;
}

function figuresOf(effect: TrapEffect): TrapFigures {
  switch (effect.kind) {
    case 'shockwave':
      return { damage: effect.damage, range: effect.radius };
    case 'beam':
      return { damage: effect.damagePerTick * TICKS_PER_BEAT, range: effect.length };
    case 'mist':
      return { heal: effect.healPerBar / BEATS_PER_BAR, range: effect.radius };
    case 'lure':
    case 'strobe':
      return { range: effect.radius };
    case 'breeze':
      return { heal: effect.healPerBeat, range: effect.length };
  }
}

const perBeat = (value: number): string => t('{count} per beat', { count: formatHundredth(value) });

export function trapEntries(traps: readonly TrapDefinition[]): ProgrammeEntry[] {
  const rows = figureRows<TrapDefinition>(traps, [
    { label: t('Damage'), of: (trap) => figuresOf(trap.effect).damage, text: perBeat },
    { label: t('Range'), of: (trap) => figuresOf(trap.effect).range },
    { label: t('Heal'), of: (trap) => figuresOf(trap.effect).heal, text: perBeat },
  ]);
  return traps.map((trap) => ({
    id: trap.id,
    name: t(trap.name),
    kind: t('Trap'),
    // As the trap the player carries lights up in the HUD.
    portrait: { glyph: trapIcon(trap.effect) },
    color: 'var(--turquoise)',
    line: t(trap.description),
    figures: rows(trap),
  }));
}

export const TRAPS_TAB: ProgrammeTab = {
  id: 'traps',
  title: () => t('Traps'),
  entries: () => trapEntries(TRAPS),
};
