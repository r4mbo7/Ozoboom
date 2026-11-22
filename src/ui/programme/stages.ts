import { SETS } from '../../data/sets';
import type { SetDefinition } from '../../data/types';
import { t } from '../../shared/i18n';
import { setTempo } from '../../sim/lineup';
import { formatTempo, formatTenth } from '../format';
import { stagePicture } from '../stage-preview';
import { STAGE_TEASERS } from '../teaser';
import { figureRows } from './figure-rows';
import { lockedEntries } from './locked';
import { createStageMap } from './stage-map';
import type { ProgrammeArt, ProgrammeEntry, ProgrammeTab } from './types';

// The square at the middle of a stage's 160 by 90 preview, which its medallion shows.
const MEDALLION = '35 0 90 90';

// A geodesic dome on its ground, for a stage of the full game in the demo.
const STAGE_DOME =
  '<path d="M2.5 18a9.5 9.5 0 0 1 19 0z" fill="currentColor"/>' +
  '<path d="M1.5 20.5h21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

// Tracks and obstacles fill against the stages shown, and so does the reverb: a dry stage has none.
export function stageEntries(
  sets: readonly SetDefinition[],
  art: Pick<ProgrammeArt, 'playStage'>,
): ProgrammeEntry[] {
  const rows = figureRows<SetDefinition>(sets, [
    { label: t('Tracks'), of: (set) => set.trackIds.length },
    {
      label: t('Obstacles'),
      of: (set) => set.obstacles?.length ?? 0,
      text: (count) => (count === 0 ? t('None') : undefined),
    },
    {
      label: t('Reverb'),
      of: (set) => set.acoustics?.reverbSeconds ?? 0,
      text: (seconds) => (seconds === 0 ? t('Dry') : `${formatTenth(seconds)}\u00a0s`),
    },
  ]);
  return sets.map((set) => ({
    id: set.id,
    name: t(set.name),
    kind: t('Stage'),
    portrait: { picture: stagePicture(set.decor), viewBox: MEDALLION },
    chips: [...(set.style === undefined ? [] : [t(set.style)]), formatTempo(setTempo(set).bpm)],
    ...(set.description === undefined ? {} : { line: t(set.description) }),
    figures: rows(set),
    listen: () => {
      art.playStage(set.id);
    },
  }));
}

// The Map tab: the stages on the festival site.
export const MAP_TAB: ProgrammeTab = {
  id: 'map',
  title: () => t('Map'),
  entries: (art) => [
    ...stageEntries(SETS, art),
    ...lockedEntries(STAGE_TEASERS, t('Stage'), STAGE_DOME),
  ],
  board: createStageMap,
};
