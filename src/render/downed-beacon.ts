import type { Sprite } from 'pixi.js';
import { BEATS_PER_BAR, type Tempo, ticksIntoBar } from '../shared/tempo';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { easeOutCubic } from './motion';
import { downedBreath } from './downed-swarm';
import { BEACON } from './textures-players-downed';
import { add, hide, setTint } from './util';

const WAVE_BEATS = 3;
const GATHER_BEATS = 0.5;
const SWELL = 0.12;
const WAVE_REACH = { from: 70, to: 330 };
const COLUMN_FOOT = 10;

export interface BeaconMoment {
  readonly breath: number;
  // 1 on the first beat of the bar, gathering over the half beat before it and fading after.
  readonly swell: number;
  // How far the bar's wave has gone, null between two.
  readonly wave: number | null;
}

// The beacon over a downed ally: steady in calm mode, otherwise breathing over two beats and calling
// once per bar, on its first beat, with one wave across the ground.
export function beaconAt(now: number, tempo: Tempo, calm: boolean): BeaconMoment {
  if (calm) {
    return { breath: 1, swell: 0, wave: null };
  }
  const beat = ticksIntoBar(now, tempo) / tempo.ticksPerBeat;
  const before = BEATS_PER_BAR - GATHER_BEATS;
  return {
    breath: 0.75 + 0.25 * downedBreath(now, tempo),
    swell: beat >= before ? smoothstep((beat - before) / GATHER_BEATS) : Math.exp(-2.5 * beat),
    wave: beat < WAVE_BEATS ? beat / WAVE_BEATS : null,
  };
}

export class DownedBeacon {
  private readonly pool: Sprite;
  private readonly wave: Sprite;
  private readonly column: Sprite;

  constructor(ctx: RenderContext) {
    const { textures, layers } = ctx;
    const looks = textures.players.downed;
    this.pool = add(layers.glow, looks.pool);
    this.wave = add(layers.glow, looks.wave);
    this.column = add(layers.fx, looks.column);
    this.column.anchor.set(0.5, 1);
  }

  hide(): void {
    hide(this.pool, this.wave, this.column);
  }

  place(x: number, y: number, scale: number, color: number, frame: Frame): void {
    const { pool, wave, column } = this;
    const { breath, swell, wave: travelled } = beaconAt(frame.now, frame.tempo, frame.calm);
    const light = breath;
    const grow = 1 + SWELL * swell;
    for (const sprite of [pool, wave, column]) {
      setTint(sprite, color);
    }
    pool.visible = column.visible = true;
    pool.position.set(x, y);
    pool.scale.set(scale * grow);
    pool.alpha = clamp01(light * (0.85 + 0.15 * swell));
    column.position.set(x, y + COLUMN_FOOT * scale);
    column.scale.set(scale * grow, scale);
    column.alpha = clamp01(light * (0.75 + 0.25 * swell));
    wave.visible = travelled !== null;
    if (travelled === null) {
      return;
    }
    const reach = lerp(WAVE_REACH.from, WAVE_REACH.to, easeOutCubic(travelled));
    wave.position.set(x, y);
    wave.scale.set((scale * reach) / BEACON.wave);
    wave.alpha = (1 - travelled) ** 1.5 * light;
  }
}
