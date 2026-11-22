import { type Container, Graphics, Sprite } from 'pixi.js';
import type { Textures } from './textures';
import type { Frame } from './frame';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { setTint } from './util';

const PAD_X = 7;
const HEIGHT = 22;
const ROUND = 6;

// A key's cap drawn in the arena, in screen pixels: a cream rounded key with its name in the ground
// colour, centred on where it is placed.
export class KeyCap {
  private readonly cap = new Graphics();
  private readonly label = new Sprite();
  private readonly textures: Pick<Textures, 'names'>;
  private drawn = '';

  constructor(parent: Container, textures: Pick<Textures, 'names'>) {
    this.textures = textures;
    this.label.anchor.set(0.5);
    parent.addChild(this.cap, this.label);
  }

  // `key` at the centre (x, y), `scale` times its size, `alpha` opaque.
  place(key: string, x: number, y: number, frame: Frame, scale = 1, alpha = 1): void {
    this.draw(key, frame);
    this.cap.visible = this.label.visible = true;
    this.cap.position.set(x, y);
    this.label.position.set(x, y);
    this.cap.scale.set(scale);
    this.label.scale.set(scale / NAME_TEXTURE_SCALE);
    this.cap.alpha = this.label.alpha = alpha;
  }

  hide(): void {
    this.cap.visible = this.label.visible = false;
  }

  private draw(key: string, frame: Frame): void {
    const drawn = `${key} ${String(frame.palette.texte)}`;
    if (drawn === this.drawn) {
      return;
    }
    this.drawn = drawn;
    const name = this.textures.names.get(key);
    this.label.texture = name.fill;
    const width = name.fill.width / NAME_TEXTURE_SCALE + 2 * PAD_X;
    this.cap.clear();
    this.cap
      .roundRect(-width / 2, -HEIGHT / 2, width, HEIGHT, ROUND)
      .fill({ color: frame.palette.texte })
      .stroke({ width: 1.5, color: frame.palette.sol });
    setTint(this.label, frame.palette.sol);
  }
}
