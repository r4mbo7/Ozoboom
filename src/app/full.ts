import type { BoardEntry, BoardEntryEnv } from './board';

export const FULL_BOARD: { readonly entry?: (env: BoardEntryEnv) => BoardEntry } = {};
