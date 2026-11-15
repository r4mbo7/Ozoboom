import { tn } from '../shared/i18n';
import type { SimState, VibeMilestone } from '../sim/state';
import { el, icon, replay, setVar } from './dom';
import { formatNumber } from './format';
import { VIBE_CHAIN_MAX, type VibeCounterShown, vibeCounterReading, vibeHeat } from './hud-model';
import { VIBE } from './icons';

const CROWN_SPARKS = 12;
const FLASH_MIN_CHAIN = 3;
// A character rolls for a quarter beat (--vibe-roll in ui.css); a vibe landing meanwhile changes it
// without starting over.
const ROLL_BEATS = 0.25;

export interface VibeCounter {
  readonly element: HTMLElement;
  update(state: Pick<SimState, 'stats' | 'tick' | 'events'>, ticksPerBeat: number): void;
  reset(): void;
}

function sparks(className: string, count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, index) => {
    const spark = el('span', className);
    setVar(spark, '--i', String(index));
    return spark;
  });
}

// The vibes picked up over the frame's steps, and the biggest milestone they crossed.
function pickedUp(events: SimState['events']): { count: number; milestone: VibeMilestone | null } {
  let count = 0;
  let milestone: VibeMilestone | null = null;
  for (const event of events) {
    if (event.type === 'pickupCollected') {
      count += 1;
    } else if (event.type === 'vibesMilestone' && milestone !== 'thousand') {
      milestone = event.milestone;
    }
  }
  return { count, milestone };
}

function orbit(className: string, index: number): HTMLElement {
  const spark = icon(className, VIBE);
  setVar(spark, '--i', String(index));
  return spark;
}

// The team's vibes since the start of the game: its digits roll and it thumps on each vibe, a spark
// turns around it at rest and one more per vibe of a chain, sinking into it when the chain lapses,
// and a crown of sparks greets each hundred (revues `.lavish/compteur-vibes` du 2026-11-14 et
// `.lavish/vibes` du 2026-11-15).
export function createVibeCounter(): VibeCounter {
  const element = el('section', 'ui-hud__vibes');
  const counter = el('span', 'ui-vibes');
  const number = el('span', 'ui-vibes__number');
  const chainSparks = Array.from({ length: VIBE_CHAIN_MAX }, (_, index) =>
    orbit('ui-vibes__orbit', index),
  );
  counter.append(
    ...sparks('ui-vibes__crown', CROWN_SPARKS),
    el('span', 'ui-vibes__flash'),
    orbit('ui-vibes__rest', 0),
    ...chainSparks,
    icon('ui-vibes__spark', VIBE),
    number,
  );
  counter.setAttribute('aria-hidden', 'true');
  element.append(counter);
  let shown: VibeCounterShown | null = null;
  let written = -1;
  let text = '';
  let characters: HTMLElement[] = [];
  const rolledAt: number[] = [];
  let lit = 0;
  let sunkAt: number | null = null;

  // Lights the chain's first `count` sparks, each newly lit one born out of the number.
  function light(count: number): void {
    chainSparks.forEach((spark, index) => {
      const on = index < count;
      if (on === (spark.dataset.on !== undefined)) {
        return;
      }
      if (on) {
        spark.dataset.on = '';
        replay(spark, 'born');
      } else {
        delete spark.dataset.on;
      }
    });
    lit = count;
  }

  function endSink(): void {
    sunkAt = null;
    delete counter.dataset.sink;
    light(0);
  }

  // The sparks of a lapsed chain spiral into the number for a beat; a vibe meanwhile cuts it short.
  function follow(chain: number, broken: number, tick: number, ticksPerBeat: number): void {
    if (broken >= FLASH_MIN_CHAIN) {
      replay(counter, 'flash');
    }
    if (broken > 0 && chain === 0) {
      sunkAt = tick;
      replay(counter, 'sink');
    } else if (broken > 0) {
      light(0);
    }
    if (sunkAt !== null && (chain > 0 || tick - sunkAt >= ticksPerBeat)) {
      endSink();
    }
    if (sunkAt === null && chain !== lit) {
      light(chain);
    }
  }

  // Writes the new total, its changed characters rolling in unless `roll` is off.
  function write(whole: number, roll: boolean, tick: number, ticksPerBeat: number): void {
    const next = formatNumber(whole);
    const shift = text.length - next.length;
    if (shift !== 0) {
      characters = Array.from(next, (_, index) => {
        const node = el('span', 'ui-vibes__char');
        node.textContent = text[index + shift] ?? '';
        return node;
      });
      number.replaceChildren(...characters);
      rolledAt.length = 0;
    }
    characters.forEach((node, index) => {
      const character = next[index] ?? '';
      if (node.textContent === character) {
        return;
      }
      const settled = tick - (rolledAt[index] ?? -Infinity) >= ROLL_BEATS * ticksPerBeat;
      if (roll && node.textContent !== '' && settled) {
        node.dataset.was = node.textContent;
        replay(node, 'roll');
        rolledAt[index] = tick;
      }
      node.dataset.now = character;
      node.textContent = character;
    });
    text = next;
    written = whole;
    const label = tn(
      whole,
      '{vibes} vibe ramassée par l’équipe',
      '{vibes} vibes ramassées par l’équipe',
      { vibes: next },
    );
    element.setAttribute('aria-label', label);
    element.title = label;
  }

  return {
    element,
    update(state, ticksPerBeat) {
      const before = shown;
      const picked = pickedUp(state.events);
      const reading = vibeCounterReading(
        before,
        state.stats.vibesCollected,
        picked.count,
        state.tick,
        ticksPerBeat,
      );
      shown = reading.shown;
      const whole = Math.floor(shown.raw);
      if (whole !== written) {
        write(whole, !reading.reseeded, state.tick, ticksPerBeat);
        if (!reading.reseeded) {
          replay(counter, 'gain');
        }
      }
      if (before?.chain !== shown.chain) {
        setVar(counter, '--vibe-heat', String(vibeHeat(shown.chain)));
      }
      if (reading.reseeded) {
        endSink();
      } else {
        follow(shown.chain, reading.broken, state.tick, ticksPerBeat);
      }
      // A frame that catches up more than a beat keeps the hundred it crossed, but crowns nothing.
      if (picked.milestone !== null) {
        counter.dataset.size = picked.milestone;
        if (!reading.reseeded) {
          replay(counter, 'crown');
        }
      }
      if (reading.reseeded) {
        delete counter.dataset.gain;
        delete counter.dataset.crown;
        delete counter.dataset.flash;
      }
    },
    reset() {
      shown = null;
      rolledAt.length = 0;
      endSink();
    },
  };
}
