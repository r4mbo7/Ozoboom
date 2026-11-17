import { Container, type Renderer, RenderTexture, Sprite, type Texture } from 'pixi.js';
import type { Frame } from './frame';
import { TrailFade } from './potion-aura-model';
import { setTint } from './util';

const BUFFER_SCALE = 0.5;
const STAMP_ALPHA = { day: 0.85, night: 0.9 };

export interface TrailStamp {
  texture: Texture;
  x: number;
  y: number;
  tint: number;
  alpha: number;
}

// The drop's echo, kept to the players under the potion: each frame stamps their silhouette in
// a screen buffer that fades by the tick, so they leave one smooth streak of colour behind them.
export class PotionTrail {
  private readonly compose = new Container();
  private readonly previous: Sprite;
  private readonly stamps: Sprite[] = [];
  private readonly display: Sprite;
  private readonly fade = new TrailFade();
  private readonly lastWorld = { x: 0, y: 0, scale: 0 };
  private readonly pixi: Renderer;
  private readonly world: Container;
  private buffers: RenderTexture[] = [];
  private width = 0;
  private height = 0;

  constructor(pixi: Renderer, world: Container, parent: Container) {
    this.pixi = pixi;
    this.world = world;
    this.previous = this.compose.addChild(new Sprite());
    this.display = parent.addChildAt(new Sprite(), 0);
    this.display.visible = false;
  }

  draw(frame: Frame, stamps: readonly TrailStamp[]): void {
    const keep = this.fade.step(frame.now, stamps.length > 0, frame.calm);
    if (!this.fade.shows) {
      this.rest();
      return;
    }
    const { world } = this;
    const { screenWidth: width, screenHeight: height } = frame.camera;
    if (width !== this.width || height !== this.height) {
      this.allocate(width, height);
    }
    const [read, write] = this.buffers;
    if (keep === null || read === undefined || write === undefined) {
      return;
    }
    const zoomed = world.scale.x !== this.lastWorld.scale;
    this.previous.texture = read;
    this.previous.position.set(world.x - this.lastWorld.x, world.y - this.lastWorld.y);
    this.previous.alpha = zoomed ? 0 : keep;
    const shown = frame.light.additive ? STAMP_ALPHA.night : STAMP_ALPHA.day;
    stamps.forEach((stamp, index) => {
      const sprite = this.stampSprite(index);
      sprite.visible = true;
      sprite.texture = stamp.texture;
      sprite.scale.set(world.scale.x);
      sprite.position.set(world.x + stamp.x * world.scale.x, world.y + stamp.y * world.scale.y);
      setTint(sprite, stamp.tint);
      sprite.alpha = stamp.alpha * shown;
    });
    for (let index = stamps.length; index < this.stamps.length; index += 1) {
      const sprite = this.stamps[index];
      if (sprite !== undefined) {
        sprite.visible = false;
      }
    }
    this.pixi.render({ container: this.compose, target: write, clear: true });
    this.buffers = [write, read];
    this.lastWorld.x = world.x;
    this.lastWorld.y = world.y;
    this.lastWorld.scale = world.scale.x;

    const scale = 1 / world.scale.x;
    this.display.texture = write;
    this.display.visible = true;
    this.display.blendMode = frame.light.additive ? 'add' : 'normal';
    this.display.scale.set(scale);
    this.display.position.set(-world.x * scale, -world.y * scale);
  }

  reset(): void {
    this.fade.clear();
    this.rest();
  }

  destroy(): void {
    this.release();
    this.compose.destroy({ children: true });
  }

  private stampSprite(index: number): Sprite {
    let sprite = this.stamps[index];
    if (sprite === undefined) {
      sprite = this.compose.addChild(new Sprite());
      sprite.anchor.set(0.5);
      this.stamps[index] = sprite;
    }
    return sprite;
  }

  // Nothing left to show: the buffers go, so a long game without the potion holds none.
  private rest(): void {
    this.display.visible = false;
    if (this.buffers.length > 0) {
      this.release();
    }
  }

  private allocate(width: number, height: number): void {
    this.release();
    const options = { width, height, resolution: BUFFER_SCALE };
    this.buffers = [RenderTexture.create(options), RenderTexture.create(options)];
    this.width = width;
    this.height = height;
    this.lastWorld.scale = 0;
  }

  private release(): void {
    for (const texture of this.buffers) {
      texture.destroy(true);
    }
    this.buffers = [];
    this.width = 0;
    this.height = 0;
  }
}
