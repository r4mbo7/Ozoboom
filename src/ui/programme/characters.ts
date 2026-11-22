import { CLASSES } from '../../data/classes';
import type { AttackDefinition, ClassDefinition } from '../../data/types';
import { t } from '../../shared/i18n';
import { TICKS_PER_BEAT } from '../../shared/tempo';
import { attackReach } from '../../sim/attacks';
import { formatTenth } from '../format';
import { CLASS_TEASERS } from '../teaser';
import { figureRows } from './figure-rows';
import { lockedEntries } from './locked';
import type { ProgrammeArt, ProgrammeEntry, ProgrammeTab } from './types';

// A dancer's head and shoulders, in a 24 box: a character of the full game, in the demo.
const BUST =
  '<circle cx="12" cy="7.6" r="4.6" fill="currentColor"/>' +
  '<path d="M3.2 22.4Q3.4 14 12 14T20.8 22.4z" fill="currentColor"/>';

const damageOf = (attack: AttackDefinition): number | undefined =>
  'damage' in attack ? attack.damage : undefined;

// Shots per beat, for an attack whose data holds its cooldown; one that strikes on the beat holds none.
const rateOf = (attack: AttackDefinition): number | undefined =>
  'cooldownTicks' in attack ? TICKS_PER_BEAT / attack.cooldownTicks : undefined;

function rateText(rate: number): string {
  return rate >= 1
    ? t('{count} per beat', { count: formatTenth(rate) })
    : t('1 every {count} beats', { count: formatTenth(1 / rate) });
}

// Every row fills against every character; damage and rate only where the data holds them.
export function characterEntries(
  classes: readonly ClassDefinition[],
  art: ProgrammeArt,
): ProgrammeEntry[] {
  const rows = figureRows<ClassDefinition>(classes, [
    { label: t('Health'), of: ({ maxHp }) => maxHp },
    { label: t('Speed'), of: ({ speed }) => speed },
    { label: t('Damage'), of: ({ attack }) => damageOf(attack) },
    { label: t('Rate'), of: ({ attack }) => rateOf(attack), text: rateText },
    { label: t('Range'), of: ({ attack }) => attackReach(attack) },
  ]);
  return classes.map((definition) => ({
    id: definition.id,
    name: t(definition.name),
    kind: t('Character'),
    portrait: {
      paint: (canvas) => {
        art.paintClass(canvas, definition.id);
      },
    },
    line: t(definition.role),
    figures: rows(definition),
    special: t(definition.skill.name),
    listen: () => {
      art.playSpecial(definition.id);
    },
  }));
}

export const CHARACTERS_TAB: ProgrammeTab = {
  id: 'characters',
  title: () => t('Characters'),
  entries: (art) => [
    ...characterEntries(CLASSES, art),
    ...lockedEntries(CLASS_TEASERS, t('Character'), BUST),
  ],
};
