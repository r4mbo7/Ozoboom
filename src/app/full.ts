import type { Leaderboard } from '../ui/types';
import type { BoardEntry, BoardEntryEnv } from './board';

export const FULL_BOARD: {
  readonly entry?: (env: BoardEntryEnv) => BoardEntry;
  readonly read?: (
    env: Pick<BoardEntryEnv, 'fetch' | 'storage'>,
    night: string,
  ) => Promise<Leaderboard>;
} = {};
