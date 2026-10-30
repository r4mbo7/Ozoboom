import type { GameContent, SetDefinition } from './types';

// Every set a game may stand on: the stages, the paths between them and the tutorial.
export function playedSets(
  content: Pick<GameContent, 'sets' | 'paths' | 'tutorial'>,
): readonly SetDefinition[] {
  return [
    ...content.sets,
    ...(content.paths ?? []),
    ...(content.tutorial === undefined ? [] : [content.tutorial]),
  ];
}
