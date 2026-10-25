import { type Container, Sprite } from 'pixi.js';
import type { Frame } from './frame';
import type { Tree } from './ground-layout';
import { crown, crownRim, shadow } from './ground-paint';
import { darker, shadowAt } from './ground-sun';
import { mixColor } from './palette';
import { setTint } from './util';

const LEAF_TEAL = { night: 0.08, day: 0.25 } as const;
const SHADOW_BODY = 100;
const SHADOW_THICKNESS = 68;

export interface TreeTone {
  readonly leaf: number;
  readonly rim: number;
  readonly rimAlpha: number;
}

function lakeTone({ palette, light }: Frame): TreeTone {
  return {
    leaf: mixColor(
      darker(palette.sol, palette.texte),
      palette.turquoise,
      light.additive ? LEAF_TEAL.night : LEAF_TEAL.day,
    ),
    rim: light.additive ? palette.or : palette.turquoise,
    rimAlpha: light.additive ? 0.32 : 0.2,
  };
}

interface View {
  readonly tree: Tree;
  readonly foot: Sprite;
  readonly crown: Sprite;
  readonly rim: Sprite;
}

function sprite(shape: { texture: Sprite['texture'] }): Sprite {
  const made = new Sprite(shape.texture);
  made.anchor.set(0.5);
  return made;
}

export function createTrees(parent: Container) {
  const shadowShape = shadow();
  const crownShape = crown();
  const rimShape = crownRim();
  let views: View[] = [];

  return {
    draw(trees: readonly Tree[]): void {
      for (const { foot, crown: body, rim } of views) {
        foot.destroy();
        body.destroy();
        rim.destroy();
      }
      views = trees.map((tree) => {
        const view = {
          tree,
          foot: sprite(shadowShape),
          crown: sprite(crownShape),
          rim: sprite(rimShape),
        };
        for (const body of [view.crown, view.rim]) {
          body.position.set(tree.x, tree.y);
          body.scale.set(tree.radius / crownShape.radius);
        }
        return view;
      });
      for (const { foot } of views) {
        parent.addChild(foot);
      }
      for (const { crown: body, rim } of views) {
        parent.addChild(body, rim);
      }
    },
    style(frame: Frame, tone = lakeTone(frame)): void {
      const { palette } = frame;
      const dark = darker(palette.sol, palette.texte);
      const sun = shadowAt(frame.fraction);
      const dx = Math.cos(sun.angle);
      const dy = Math.sin(sun.angle);
      for (const { tree, foot, crown: body, rim } of views) {
        setTint(body, tone.leaf);
        setTint(rim, tone.rim);
        rim.alpha = tone.rimAlpha;
        setTint(foot, dark);
        foot.visible = sun.alpha > 0.002;
        const reach = (0.4 + sun.length) * tree.radius * 0.5;
        foot.position.set(tree.x + dx * reach, tree.y + dy * reach);
        foot.rotation = sun.angle;
        foot.scale.set(
          ((1.4 + sun.length) * tree.radius) / SHADOW_BODY,
          (1.62 * tree.radius) / SHADOW_THICKNESS,
        );
        foot.alpha = sun.alpha;
      }
    },
    destroy(): void {
      for (const shape of [shadowShape, crownShape, rimShape]) {
        shape.texture.destroy(true);
      }
    },
  };
}
