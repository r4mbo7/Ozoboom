import { ENEMIES } from '../../data/enemies';
import { t } from '../../shared/i18n';
import { BOSS_MASK } from '../icons';
import { BOSS_TEASERS } from '../teaser';
import { enemyEntries, isBoss } from './enemies';
import { lockedEntries } from './locked';
import type { ProgrammeTab } from './types';

export const BOSSES_TAB: ProgrammeTab = {
  id: 'bosses',
  title: () => t('Bosses'),
  entries: (art) => [
    ...enemyEntries(ENEMIES.filter(isBoss), ENEMIES, t('Boss'), art),
    ...lockedEntries(BOSS_TEASERS, t('Boss'), BOSS_MASK),
  ],
};
