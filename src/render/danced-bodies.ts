import { lerp } from '../shared/scalar';
import { MAIN_TEMPO } from '../shared/tempo';
import type { PlayerId, PlayerState, SimState } from '../sim/state';
import type { Frame } from './frame';
import { type DanceClock, IdleDance } from './idle-dance';

// A share of its top speed: below it, a player stands still, though bodies may push it.
export const WALKING = 0.15;
const GROW = 0.14;
const SQUASH = 0.09;

// Where a player's body is drawn this frame, its idle dance included: what a family hangs on the
// body (a held stick, a horn, flags, a flame on a torch, its shadow) is placed from here.
export interface DancedBody {
  x: number;
  y: number;
  facing: number;
  // The body's scale against its rest size, and how high off the ground it is (0 on it).
  grow: number;
  lift: number;
}

interface Entry {
  readonly dance: IdleDance;
  readonly body: DancedBody;
  now: number;
}

// One per scene: each player's dance is placed once per frame, by whichever family asks first.
export class DancedBodies {
  private readonly entries = new Map<PlayerId, Entry>();
  private readonly clock: DanceClock = {
    now: 0,
    tempo: MAIN_TEMPO,
    seed: 0,
    playerId: 0,
    segment: 'buildup',
    segmentStartTick: 0,
    hops: undefined,
    calm: false,
  };

  of(state: SimState, player: PlayerState, alpha: number, frame: Frame): Readonly<DancedBody> {
    const entry = this.entryOf(player.id);
    const { now } = frame;
    if (entry.now === now) {
      return entry.body;
    }
    if (now < entry.now) {
      entry.dance.reset();
    }
    entry.now = now;
    const clock = this.clock;
    clock.now = now;
    clock.tempo = frame.tempo;
    clock.seed = state.seed;
    clock.playerId = player.id;
    clock.segment = state.set.segment;
    clock.segmentStartTick = state.set.segmentStartTick;
    clock.hops = frame.set.danceHops;
    clock.calm = frame.calm;
    const moved = Math.hypot(player.x - player.prevX, player.y - player.prevY);
    const walking = player.downed || (player.speed > 0 && moved / player.speed > WALKING);
    const pose = entry.dance.place(clock, walking);
    const facing = Math.atan2(player.aim.y, player.aim.x);
    const shift = pose.shift * player.radius;
    const body = entry.body;
    body.x = lerp(player.prevX, player.x, alpha) - Math.sin(facing) * shift;
    body.y = lerp(player.prevY, player.y, alpha) + Math.cos(facing) * shift;
    body.facing = facing + pose.turn;
    body.grow = (1 + GROW * pose.lift) * (1 - SQUASH * pose.squash);
    body.lift = pose.lift;
    return body;
  }

  private entryOf(id: PlayerId): Entry {
    let entry = this.entries.get(id);
    if (entry === undefined) {
      entry = {
        dance: new IdleDance(),
        body: { x: 0, y: 0, facing: 0, grow: 1, lift: 0 },
        now: Number.NaN,
      };
      this.entries.set(id, entry);
    }
    return entry;
  }
}
