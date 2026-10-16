import { FULL_TEASERS } from '../data/full';
import type { TeaserDefinition } from '../data/types';
import { t } from '../shared/i18n';
import { openDiscord } from './discord';
import { el, icon } from './dom';
import { LOCK } from './icons';

export const CLASS_TEASERS = FULL_TEASERS.filter((teaser) => teaser.kind === 'class');
export const STAGE_TEASERS = FULL_TEASERS.filter((teaser) => teaser.kind === 'stage');

// The choice of the stage shows when there is more than one to see, locked ones included.
export function showsStageChoice(stages: number): boolean {
  return stages + STAGE_TEASERS.length > 1;
}

// A card of the full game in the demo's pickers: the arrows pass it by, a click tells where to hear
// more about it.
function teaser(className: string, entry: TeaserDefinition): HTMLButtonElement {
  const node = el('button', `${className} ui-teaser`);
  node.type = 'button';
  node.tabIndex = -1;
  node.style.setProperty('--class-color', entry.color);
  node.setAttribute('aria-label', t('{name}, dans le jeu complet', { name: t(entry.name) }));
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    openDiscord();
  });
  return node;
}

export function classTeaser(entry: TeaserDefinition): HTMLButtonElement {
  const node = teaser('ui-classcard', entry);
  const name = el('span', 'ui-classcard__name ui-teaser__text');
  name.append(el('span', '', t(entry.name)), el('span', 'ui-teaser__note', t('Jeu complet')));
  node.append(icon('ui-classcard__portrait ui-teaser__lock', LOCK), name);
  return node;
}

export function stageTeaser(entry: TeaserDefinition): HTMLButtonElement {
  const node = teaser('ui-stage', entry);
  const preview = el('span', 'ui-stage__preview ui-teaser__preview');
  preview.append(icon('ui-teaser__lock', LOCK));
  const meta = el('span', 'ui-stage__meta');
  if (entry.style !== undefined) {
    meta.append(el('span', 'ui-stage__chip', t(entry.style)));
  }
  meta.append(el('span', 'ui-stage__chip ui-teaser__note', t('Jeu complet')));
  node.append(preview, el('span', 'ui-stage__name', t(entry.name)), meta);
  return node;
}
