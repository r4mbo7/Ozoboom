import { FUSIONS } from '../../data/fusions';
import { UPGRADES } from '../../data/upgrades';
import { weaponGlyph } from '../../data/weapon-glyphs';
import { WEAPONS } from '../../data/weapons';
import type { FusionDefinition, UpgradeDefinition, WeaponDefinition } from '../../data/types';
import { t } from '../../shared/i18n';
import { SIXTEENTHS_PER_BAR } from '../cards';
import { figuresOf } from '../class-figures';
import { formatHundredth } from '../format';
import { figureRows } from './figure-rows';
import type { ProgrammeArt, ProgrammeEntry, ProgrammeTab } from './types';

// Its hits in a bar; a prop that plays non-stop fills every sixteenth, as its card's strip lights.
function hitsPerBar({ rhythm }: WeaponDefinition): number {
  return rhythm === 'continuous' ? SIXTEENTHS_PER_BAR : rhythm.steps.length / rhythm.everyBars;
}

const perBar = (value: number): string => t('{count}/bar', { count: formatHundredth(value) });

// « B2B: Diabolo + Double Beam », as its fusion card says it.
function recipeOf(
  weapon: WeaponDefinition,
  weapons: readonly WeaponDefinition[],
  fusions: readonly FusionDefinition[],
  upgrades: readonly UpgradeDefinition[],
): string | undefined {
  const fusion = fusions.find((candidate) => candidate.resultId === weapon.id);
  const from = weapons.find((candidate) => candidate.id === fusion?.weaponId);
  const upgrade = upgrades.find((candidate) => candidate.id === fusion?.upgradeId);
  if (from === undefined || upgrade === undefined) {
    return undefined;
  }
  return t('B2B: {recipe}', {
    recipe: t('{weapon} + {upgrade}', { weapon: t(from.name), upgrade: t(upgrade.name) }),
  });
}

export function propEntries(
  weapons: readonly WeaponDefinition[],
  fusions: readonly FusionDefinition[],
  upgrades: readonly UpgradeDefinition[],
  art: ProgrammeArt,
): ProgrammeEntry[] {
  const rows = figureRows<WeaponDefinition>(weapons, [
    { label: t('Damage'), of: (weapon) => figuresOf(weapon.effect).damage },
    {
      label: t('Rate'),
      of: hitsPerBar,
      text: (value, weapon) => (weapon.rhythm === 'continuous' ? t('Non-stop') : perBar(value)),
    },
    { label: t('Range'), of: (weapon) => figuresOf(weapon.effect).range },
    {
      label: t('Heal'),
      of: (weapon) => figuresOf(weapon.effect).heal,
      text: (value, weapon) =>
        figuresOf(weapon.effect).healsPerBar === true ? perBar(value) : formatHundredth(value),
    },
  ]);
  return weapons.map((weapon) => {
    const fused = weapon.evolvedFrom !== undefined;
    const note = fused ? recipeOf(weapon, weapons, fusions, upgrades) : undefined;
    const listen = art.weaponSound(weapon.id);
    return {
      id: weapon.id,
      name: t(weapon.name),
      kind: fused ? t('Fusion') : t('Prop'),
      // The glyph of its card's medal and of its place in the HUD.
      portrait: { glyph: weaponGlyph(weapon.effect) },
      color: fused ? 'var(--mage)' : 'var(--turquoise)',
      line: t(weapon.description),
      ...(note === undefined ? {} : { note }),
      figures: rows(weapon),
      ...(listen === null ? {} : { listen }),
    };
  });
}

export const PROPS_TAB: ProgrammeTab = {
  id: 'props',
  title: () => t('Props'),
  subtitle: () => t('(weapons)'),
  entries: (art) => propEntries(WEAPONS, FUSIONS, UPGRADES, art),
};
