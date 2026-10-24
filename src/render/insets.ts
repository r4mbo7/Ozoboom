import { Container, type Renderer as PixiRenderer, RenderTexture, Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Inset, RenderOptions } from './types';

// A scene of the game that paints one inset with the renderer and the textures of the game.
export interface InsetScene {
  frameInset(width: number, height: number, viewHeight: number): void;
  renderInto(state: SimState, alpha: number, target: RenderTexture): void;
  setOptions(options: Partial<RenderOptions>): void;
  destroy(): void;
}

export interface Insets {
  readonly painting: boolean;
  set(insets: readonly Inset[]): void;
  setOptions(options: Partial<RenderOptions>): void;
  // Draws each inset whose world moved on a step into a texture of its own, lays them side by side
  // at the top left of the canvas of the game and copies them out at once, before the game is drawn
  // over them. An inset is drawn on its step, never between two: a still world is drawn once.
  // Answers whether it drew anything.
  paint(): boolean;
  // While the game stands still: `drawGame` draws it once into an image kept for the purpose, which
  // covers the top left of the canvas again after each paint of the insets.
  holdStill(drawGame: (target: RenderTexture) => void): void;
  // The game moves again, or the canvas changed size: the kept image is out of date.
  release(): void;
  destroy(): void;
}

interface Painted {
  scene: InsetScene;
  texture: RenderTexture;
  sprite: Sprite;
  // The step and the size it was last drawn at.
  shown: string;
}

export function createInsets(
  pixi: PixiRenderer,
  create: (width: number, height: number) => InsetScene,
): Insets {
  let insets: readonly Inset[] = [];
  const painted = new Map<HTMLCanvasElement, Painted>();
  const sheet = new Container();
  const copy = document.createElement('canvas');
  const still = RenderTexture.create({ width: 1, height: 1, resolution: pixi.resolution });
  const stillView = new Container();
  stillView.addChild(new Sprite(still));
  let held = false;

  function showStill(): void {
    pixi.render({ container: stillView, clear: true });
  }

  function textureFor(width: number, height: number): RenderTexture {
    return RenderTexture.create({ width, height, resolution: pixi.resolution });
  }

  return {
    get painting() {
      return insets.length > 0;
    },
    set(next) {
      insets = next;
      for (const [canvas, entry] of painted) {
        if (!next.some((inset) => inset.canvas === canvas)) {
          entry.scene.destroy();
          entry.sprite.destroy();
          entry.texture.destroy(true);
          painted.delete(canvas);
        }
      }
    },
    setOptions(options) {
      for (const { scene } of painted.values()) {
        scene.setOptions(options);
      }
    },
    paint() {
      const { resolution } = pixi;
      const room = pixi.screen.width;
      const laid: {
        inset: Inset;
        x: number;
        y: number;
        width: number;
        height: number;
        moved: boolean;
      }[] = [];
      let x = 0;
      let y = 0;
      let row = 0;
      for (const inset of insets) {
        const width = inset.canvas.clientWidth;
        const height = inset.canvas.clientHeight;
        if (width === 0 || height === 0) {
          continue;
        }
        if (x > 0 && x + width > room) {
          x = 0;
          y += row;
          row = 0;
        }
        let entry = painted.get(inset.canvas);
        if (entry === undefined) {
          const texture = textureFor(width, height);
          entry = { scene: create(width, height), texture, sprite: new Sprite(texture), shown: '' };
          sheet.addChild(entry.sprite);
          painted.set(inset.canvas, entry);
        } else if (entry.texture.width !== width || entry.texture.height !== height) {
          entry.texture.resize(width, height, resolution);
        }
        const shown = `${String(inset.state.tick)} ${String(width)}x${String(height)}`;
        const moved = shown !== entry.shown;
        if (moved) {
          entry.shown = shown;
          entry.scene.frameInset(width, height, inset.viewHeight);
          entry.scene.renderInto(inset.state, 1, entry.texture);
        }
        entry.sprite.position.set(x, y);
        laid.push({ inset, x, y, width, height, moved });
        x += width;
        row = Math.max(row, height);
      }
      if (!laid.some((spot) => spot.moved)) {
        return false;
      }
      pixi.render({ container: sheet, clear: true });
      const wide = Math.round(Math.max(...laid.map((spot) => spot.x + spot.width)) * resolution);
      const high = Math.round((y + row) * resolution);
      if (copy.width < wide || copy.height < high) {
        copy.width = Math.max(copy.width, wide);
        copy.height = Math.max(copy.height, high);
      }
      const shared = copy.getContext('2d');
      shared?.clearRect(0, 0, wide, high);
      shared?.drawImage(pixi.canvas, 0, 0, wide, high, 0, 0, wide, high);
      for (const spot of laid.filter((entry) => entry.moved)) {
        const { canvas } = spot.inset;
        const pixelsWide = Math.round(spot.width * resolution);
        const pixelsHigh = Math.round(spot.height * resolution);
        if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
          canvas.width = pixelsWide;
          canvas.height = pixelsHigh;
        }
        canvas
          .getContext('2d')
          ?.drawImage(
            copy,
            Math.round(spot.x * resolution),
            Math.round(spot.y * resolution),
            pixelsWide,
            pixelsHigh,
            0,
            0,
            pixelsWide,
            pixelsHigh,
          );
      }
      return true;
    },
    holdStill(drawGame) {
      if (!held) {
        const { width, height } = pixi.screen;
        still.resize(width, height, pixi.resolution);
        drawGame(still);
        held = true;
        this.paint();
        showStill();
      } else if (this.paint()) {
        showStill();
      }
    },
    release() {
      held = false;
    },
    destroy() {
      this.set([]);
      stillView.destroy({ children: true });
      still.destroy(true);
    },
  };
}
