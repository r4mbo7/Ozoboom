import { TUTORIAL } from '../data/tutorial';
import type { BoardLine } from '../ui/types';
import type { RecordedGame } from './recording';

// A run that ended on its end screen, as the leaderboard takes it.
export interface FinishedRun {
  // The UTC day the run started on: a run that ends past midnight belongs to its night.
  readonly night: string;
  readonly classId: string;
  readonly score: number;
  readonly recording: string;
}

// The end screen's part of the leaderboard: one run offered, sent once the player shares it.
export interface BoardEntry {
  finish(run: FinishedRun): void;
  name(pseudo: string): void;
  // A new game starts: a late answer to the last run shows nothing.
  leave(): void;
}

export interface BoardEntryEnv {
  readonly fetch: typeof fetch;
  readonly storage: () => Storage | null;
  pseudo(): string;
  keepPseudo(pseudo: string): void;
  online(): boolean;
  show(line: BoardLine | null): void;
}

// Only a classic solo run of a deployed game is ranked: one player, offline of a room, no
// festival, no tutorial, no dev mode (ADR 0023).
export function ranksRun(
  game: Pick<RecordedGame, 'players' | 'festival' | 'setId' | 'query'>,
  inRoom: boolean,
): boolean {
  return (
    !inRoom &&
    game.players.length === 1 &&
    !game.festival &&
    game.setId !== TUTORIAL.id &&
    !new URLSearchParams(game.query).has('dev')
  );
}

export function nightOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}
