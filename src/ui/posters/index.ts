import { FULL_POSTERS } from '../full';
import { mainStageRipples, mainStageSun } from './main-stage';
import type { PosterDrawing } from './pen';

const POSTERS: Readonly<Record<string, PosterDrawing>> = {
  'main-stage-sun': mainStageSun,
  'main-stage-ripples': mainStageRipples,
  ...FULL_POSTERS,
};

export function posterDrawing(id: string): PosterDrawing {
  const drawing = POSTERS[id];
  if (drawing === undefined) {
    throw new Error(`No drawing for the poster ${id}`);
  }
  return drawing;
}
