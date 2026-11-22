import { TRAPS } from '../../data/traps';
import type { RarityForm, StatModifier, UpgradeDefinition, UpgradeFamily } from '../../data/types';
import { UPGRADES } from '../../data/upgrades';
import { t } from '../../shared/i18n';
import { leadStat } from '../../sim/stats';
import { familyLabels } from '../cards';
import { formatFactor, formatHundredth } from '../format';
import { trapFanIcon, trapIcon, upgradeIcon } from '../icons';
import { mostOf } from './figures';
import type { Figure, ProgrammeEntry, ProgrammeTab } from './types';

// The colour of each family's medal on its level-up card.
const FAMILY_COLORS: Readonly<Record<UpgradeFamily, string>> = {
  class: 'var(--mage)',
  generic: 'var(--turquoise)',
  defense: 'var(--tank)',
  relic: 'var(--or)',
};

// How far a modifier moves its stat from untouched.
function strengthOf({ add, mul }: StatModifier): number {
  return mul === undefined ? Math.abs(add ?? 0) : Math.abs(mul - 1);
}

function valueOf({ add, mul }: StatModifier): string {
  return mul === undefined
    ? t('+{count}', { count: formatHundredth(add ?? 0) })
    : formatFactor(mul);
}

// What each rarity gives, the legendary filling the five pips: none for a card without rarities.
function rarityFigures(upgrade: UpgradeDefinition): Figure[] {
  const { rarities } = upgrade;
  if (rarities === undefined) {
    return [];
  }
  const forms: readonly [string, RarityForm][] = [
    [t('Common'), upgrade],
    [t('Rare'), rarities.rare],
    [t('Legendary'), rarities.legendary],
  ];
  const leads = forms.flatMap(([label, form]) => {
    const [lead] = form.modifiers;
    return lead === undefined ? [] : [{ label, lead }];
  });
  const most = mostOf(leads.map(({ lead }) => strengthOf(lead)));
  return leads.map(({ label, lead }) => ({
    label,
    value: strengthOf(lead),
    most,
    text: valueOf(lead),
  }));
}

// The trap a card gives, as its card draws it: the likeliest one it may show, or every one a
// surprise may give, fanned out.
function upgradeGlyph(upgrade: UpgradeDefinition): string {
  const gift = upgrade.gives?.trap;
  if (gift === 'surprise') {
    return trapFanIcon(TRAPS.map((trap) => trap.effect));
  }
  const likeliest = [...TRAPS].sort((a, b) => b.carrierWeight - a.carrierWeight)[0];
  return gift === 'shown' && likeliest !== undefined
    ? trapIcon(likeliest.effect)
    : upgradeIcon(upgrade.id, upgrade.family, leadStat(upgrade));
}

// Every card every character may be dealt; a class's own cards belong to its character.
export function upgradeEntries(upgrades: readonly UpgradeDefinition[]): ProgrammeEntry[] {
  return upgrades
    .filter((upgrade) => upgrade.family !== 'class')
    .map((upgrade) => ({
      id: upgrade.id,
      name: t(upgrade.name),
      kind: familyLabels()[upgrade.family],
      portrait: { glyph: upgradeGlyph(upgrade) },
      color: FAMILY_COLORS[upgrade.family],
      line: t(upgrade.description),
      figures: rarityFigures(upgrade),
    }));
}

export const UPGRADES_TAB: ProgrammeTab = {
  id: 'upgrades',
  title: () => t('Upgrades'),
  entries: () => upgradeEntries(UPGRADES),
};
