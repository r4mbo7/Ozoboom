import type { PlayerId, SimEvent, SimState } from '../sim/state';
import { teleport } from './fixture';

interface Seat {
  readonly name: string;
  readonly classId: string;
  readonly dx: number;
  readonly dy: number;
  readonly downed: boolean;
}

// Four players around the stage: two lie down (the second is being picked up), the last stands far out of frame.
const SEATS: readonly Seat[] = [
  { name: 'Camille', classId: 'mage', dx: -600, dy: 40, downed: false },
  { name: 'Roadie Max', classId: 'tank', dx: 120, dy: 130, downed: true },
  { name: 'Inès', classId: 'healer', dx: 190, dy: -90, downed: true },
  { name: 'Lou', classId: 'mage', dx: 650, dy: -330, downed: false },
];

export const REVIVED_PLAYER: PlayerId = 2;
export const REVIVING_PLAYER: PlayerId = 0;

export function layCoop(state: SimState): void {
  const template = state.players[0];
  if (template === undefined) {
    throw new Error('The fixture has no player to copy');
  }
  state.players = SEATS.map((seat, id) => {
    const player = {
      ...template,
      id: id as PlayerId,
      name: seat.name,
      classId: seat.classId,
      downed: seat.downed,
      aim: { x: seat.dx > 0 ? -1 : 1, y: 0 },
    };
    teleport(player, state.core.x + seat.dx, state.core.y + seat.dy);
    return player;
  });
}

export function reviveEvents(progress: number): SimEvent[] {
  return [
    {
      type: 'playerReviving',
      playerId: REVIVED_PLAYER,
      byPlayer: REVIVING_PLAYER,
      progress,
    },
  ];
}
