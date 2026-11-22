import { ENEMIES } from '../../data/enemies';
import { t } from '../../shared/i18n';
import { enemyEntries, isBoss } from './enemies';
import type { ProgrammeTab } from './types';

export const BAD_VIBES_TAB: ProgrammeTab = {
  id: 'bad-vibes',
  title: () => t('Bad vibes'),
  subtitle: () => t('(enemies)'),
  entries: (art) =>
    enemyEntries(
      ENEMIES.filter((enemy) => !isBoss(enemy)),
      ENEMIES,
      t('Bad vibe'),
      art,
    ),
};
