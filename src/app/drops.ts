import { type GameDrop, type GameOutcome, MAX_DROPS } from '../shared/stats';
import type { SimState } from '../sim/state';
import { bossLeft } from '../sim/systems/set-progress';

interface PlayingDrop {
  stage: string;
  tier: number;
  startTick: number;
  bars: number;
}

// A drop opens on the sim's own `segment` event: a finished stage of a festival stays in `drop`,
// tier past its last, through the walk to the next. It ends, beaten, once the set moves on from it;
// its bars are the `bar` events of the steps it plays, the bar line that ends it aside.
export function createDropTracker() {
  const played: GameDrop[] = [];
  let playing: PlayingDrop | null = null;
  const keep = ({ stage, tier, bars }: PlayingDrop, bossFell: boolean) => {
    if (played.length < MAX_DROPS && bars > 0) {
      played.push({ stage, tier, bars, bossFell });
    }
  };
  return {
    step(state: SimState) {
      if (playing !== null && !isPlaying(playing, state)) {
        keep(playing, true);
        playing = null;
      }
      if (playing === null && opensDrop(state)) {
        playing = {
          stage: state.setId,
          tier: state.set.tier,
          startTick: state.set.segmentStartTick,
          bars: 0,
        };
      }
      if (playing !== null) {
        playing.bars += barsOf(state);
      }
    },
    // The drop the game was lost in counts; one left by a quit or a cut does not.
    end(state: SimState, outcome: GameOutcome): GameDrop[] {
      if (playing !== null && (outcome === 'core' || outcome === 'downed')) {
        keep(playing, !bossLeft(state));
      }
      return played;
    },
  };
}

function barsOf({ events }: SimState): number {
  let bars = 0;
  for (const event of events) {
    if (event.type === 'bar') {
      bars += 1;
    }
  }
  return bars;
}

function opensDrop({ events }: SimState): boolean {
  return events.some((event) => event.type === 'segment' && event.segment === 'drop');
}

function isPlaying(drop: PlayingDrop, { setId, set }: SimState): boolean {
  return (
    set.segment === 'drop' &&
    setId === drop.stage &&
    set.tier === drop.tier &&
    set.segmentStartTick === drop.startTick
  );
}
