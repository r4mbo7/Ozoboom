import type { Sprite } from 'pixi.js';
import { WAVES, outlineAt, waveAt, type OutlineMoment, type WaveMoment } from './emote-moments';
import { show } from './emote-sun';
import type { Frame } from './frame';
import type { Shape } from './paint';
import type { EmoteTextures } from './textures-players';
import { OUTLINE_DISC, WAVE_RING } from './textures-players-emotes';

const UNTINTED = 0xffffff;

type Make = (shape: Shape) => Sprite;

// The waves from the feet and the lit outline, so that the others turn to the player.
export class EmoteCall {
  private readonly waves: readonly Sprite[];
  private readonly outline: Sprite;
  private readonly liner: Sprite;
  private readonly wave: WaveMoment = { radius: 0, alpha: 0 };
  private readonly lit: OutlineMoment = { swell: 0, alpha: 0 };
  private readonly textures: EmoteTextures;

  constructor(textures: EmoteTextures, onGround: Make, underBody: Make) {
    this.textures = textures;
    this.waves = Array.from({ length: WAVES }, () => onGround(textures.wave));
    this.outline = underBody(textures.outline.body);
    this.liner = underBody(textures.liner.body);
  }

  place(
    t: number,
    x: number,
    y: number,
    angle: number,
    scale: number,
    color: number,
    cover: number | undefined,
    frame: Frame,
  ): void {
    this.waves.forEach((sprite, index) => {
      const { radius, alpha } = waveAt(index, t, frame.calm, this.wave);
      show(sprite, x, y, radius / WAVE_RING, NaN, color, alpha);
    });
    const { swell, alpha } = outlineAt(t, frame.calm, this.lit);
    const shape = cover === undefined ? 'body' : 'disc';
    const fit = cover === undefined ? 1 : cover / OUTLINE_DISC;
    const size = scale * fit * (1 + 0.1 * swell);
    this.outline.texture = this.textures.outline[shape].texture;
    this.liner.texture = this.textures.liner[shape].texture;
    show(this.outline, x, y, size, NaN, color, alpha * (0.75 + 0.25 * swell));
    show(this.liner, x, y, size, NaN, UNTINTED, alpha);
    this.outline.rotation = angle;
    this.liner.rotation = angle;
  }
}
