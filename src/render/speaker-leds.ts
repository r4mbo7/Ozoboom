import { Graphics } from 'pixi.js';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import type { Frame } from './frame';
import { ofSpeaker, plugShare } from './speaker-kit';
import { setTint } from './util';

export const LEDS = 8;
const DANCE_FLOOR = 4;
const DANCE_LEVELS = 5;
const DANCE_DROP = 3;
const DRAWN_RADIUS = 40;
const LED_GAP = 4;
const LED_WIDTH = 9;
const LED_HEIGHT = 8;
const LED_STEP = 10.5;
const LED_BOTTOM = 38;
const UNLIT_ALPHA = 0.22;
const STANDBY_DIM = 0.25;

// How far each drawing reaches from its centre, drawn for a radius of 40.
export const SPEAKER_EXTENTS: Readonly<Record<string, number>> = {
  'dome-chill': 60,
  foret: 52,
  sub: 50,
  'cercle-acid': 50,
};

export interface LedView {
  readonly leds: Graphics;
  readonly standby: Graphics;
  ledKey: string;
}

interface Plug {
  readonly id: string;
  readonly plugTicks: number;
  readonly plugged: boolean;
}

function scramble(value: number): number {
  let hash = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function seedOf(id: string): number {
  let seed = 0;
  for (let index = 0; index < id.length; index += 1) {
    seed = Math.imul(seed, 31) + id.charCodeAt(index);
  }
  return seed;
}

export function danceLevel(now: number, id: string, tempo: Tempo = MAIN_TEMPO): number {
  const beats = now / tempo.ticksPerBeat;
  const beat = Math.floor(beats);
  const level = DANCE_FLOOR + (scramble(beat * 7919 + seedOf(id)) % DANCE_LEVELS);
  return Math.round(level - (beats - beat) * DANCE_DROP);
}

export function litLeds(
  speaker: Plug,
  plugBars: number,
  frame: Pick<Frame, 'now' | 'calm' | 'tempo'>,
): number {
  if (speaker.plugged) {
    return frame.calm ? LEDS : danceLevel(frame.now, speaker.id, frame.tempo);
  }
  return Math.floor(plugShare(speaker.plugTicks, plugBars, frame.tempo.ticksPerBar) * LEDS + 1e-6);
}

export function standbyOn(frame: Pick<Frame, 'now' | 'calm' | 'tempo'>): boolean {
  const { ticksPerBar } = frame.tempo;
  return frame.calm || frame.now % ticksPerBar < ticksPerBar / 4;
}

export function createLedViews(): Pick<LedView, 'leds' | 'standby'> {
  return { leds: new Graphics(), standby: new Graphics().circle(0, 0, 4).fill(0xffffff) };
}

// Eight LEDs right of the drawing, bottom to top, the top one white at night once plugged; above
// them, the standby LED of an unplugged speaker.
export function drawLeds(
  view: LedView,
  speaker: Plug & { readonly x: number; readonly y: number; readonly radius: number },
  plugBars: number,
  color: number,
  dim: number,
  frame: Frame,
): void {
  const { leds, standby } = view;
  const scale = speaker.radius / DRAWN_RADIUS;
  const extent = ofSpeaker(SPEAKER_EXTENTS, speaker.id, 'extent');
  leds.visible = true;
  leds.position.set(speaker.x, speaker.y);
  leds.scale.set(scale);
  const lit = litLeds(speaker, plugBars, frame);
  const night = frame.light.additive;
  const top = speaker.plugged && night ? 0xffffff : color;
  const unlit = speaker.plugged || speaker.plugTicks > 0 ? color : dim;
  const edge = night ? 0x000000 : frame.palette.texte;
  const key = `${String(lit)},${String(color)},${String(top)},${String(unlit)},${String(edge)}`;
  if (view.ledKey !== key) {
    view.ledKey = key;
    leds.clear();
    for (let index = 0; index < LEDS; index += 1) {
      const y = LED_BOTTOM - index * LED_STEP - LED_HEIGHT / 2;
      leds
        .roundRect(extent + LED_GAP, y, LED_WIDTH, LED_HEIGHT, 2)
        .stroke({ width: 3, color: edge, alpha: night ? 0.6 : 0.75 });
      leds
        .roundRect(extent + LED_GAP, y, LED_WIDTH, LED_HEIGHT, 2)
        .fill(
          index < lit
            ? { color: index === LEDS - 1 ? top : color, alpha: 1 }
            : { color: unlit, alpha: UNLIT_ALPHA },
        );
    }
  }

  standby.visible = !speaker.plugged;
  if (standby.visible) {
    setTint(standby, color);
    standby.position.set(
      speaker.x + (extent + LED_GAP + LED_WIDTH / 2) * scale,
      speaker.y + (LED_BOTTOM - LEDS * LED_STEP - 1) * scale,
    );
    standby.scale.set(scale);
    standby.alpha = standbyOn(frame) ? 1 : STANDBY_DIM;
  }
}
