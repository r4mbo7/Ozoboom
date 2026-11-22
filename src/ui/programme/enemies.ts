import type { EnemyDefinition } from '../../data/types';
import { t } from '../../shared/i18n';
import { figureRows } from './figure-rows';
import { mostOf } from './figures';
import type { ProgrammeArt, ProgrammeEntry } from './types';

export const isBoss = (enemy: EnemyDefinition): boolean => enemy.behaviour === 'boss';

// Life and damage fill against the tab's own; speed against every enemy's, so a boss reads slower.
export function enemyEntries(
  shown: readonly EnemyDefinition[],
  all: readonly EnemyDefinition[],
  kind: string,
  art: ProgrammeArt,
): ProgrammeEntry[] {
  const rows = figureRows<EnemyDefinition>(shown, [
    { label: t('Health'), of: ({ maxHp }) => maxHp },
    { label: t('Speed'), of: ({ speed }) => speed, most: mostOf(all.map(({ speed }) => speed)) },
    { label: t('Damage'), of: ({ damage }) => damage },
  ]);
  return shown.map((enemy) => ({
    id: enemy.id,
    name: t(enemy.name),
    kind,
    portrait: {
      paint: (canvas) => {
        art.paintMask(canvas, enemy.id);
      },
    },
    ...(enemy.description === undefined ? {} : { line: t(enemy.description) }),
    figures: rows(enemy),
  }));
}
