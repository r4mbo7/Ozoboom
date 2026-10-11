import { Container, Graphics, Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import {
  type Trail,
  VEIL_ANGLE,
  VEIL_COUNT,
  VEIL_LENGTH,
  hsl,
  trailGlow,
  trailsAt,
  veilLookAt,
  veilsAt,
} from './cosmic-filter';
import type { Frame } from './frame';
import { WHITE, paint } from './paint';

const SEGMENTS = 8;
const NIGHT = { saturation: 0.95, lightness: 0.82, head: 0.94, alpha: 0.85, width: 1.6 };
const DAY = { saturation: 0.7, lightness: 0.38, head: 0.38, alpha: 0.7, width: 1.85 };
const HALOS = [
  { width: 7, alpha: 0.12 },
  { width: 3.5, alpha: 0.28 },
];

// Along a trail, from its tail (0) to its head (1): clear at the tail, brightest at the head, its hue turning.
function shade(at: number): { opacity: number; hue: number; head: number } {
  return at < 0.6
    ? { opacity: (0.7 * at) / 0.6, hue: (30 * at) / 0.6, head: 0 }
    : {
        opacity: 0.7 + (0.3 * (at - 0.6)) / 0.4,
        hue: 30 + (30 * (at - 0.6)) / 0.4,
        head: (at - 0.6) / 0.4,
      };
}

// The cosmic filter of a stage with `decor: 'ambyss'`: fine trails let loose on the beat, as in a cloud chamber,
// and wide veils of light sliding once a phrase. Laid over the decor, under everything that moves.
export function createCosmic(ctx: RenderContext): Family {
  const root = new Container();
  ctx.layers.decor.addChild(root);
  const band = paint(64, 4, 0, (canvas) => {
    const gradient = canvas.createLinearGradient(-32, 0, 32, 0);
    gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
    gradient.addColorStop(0.5, WHITE);
    gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
    canvas.fillStyle = gradient;
    canvas.fillRect(-32, -2, 64, 4);
  });
  const veils = new Container();
  veils.rotation = VEIL_ANGLE;
  const sheets = Array.from({ length: VEIL_COUNT }, () => {
    const sheet = new Sprite(band.texture);
    sheet.anchor.set(0.5);
    veils.addChild(sheet);
    return sheet;
  });
  const halos = new Graphics();
  halos.blendMode = 'add';
  const trails = new Graphics();
  root.addChild(veils, halos, trails);

  let lookedAt = Number.NaN;
  let veilLook = veilLookAt(0);

  function drawTrail(trail: Trail, frame: Frame): void {
    const { grow, fade } = trailGlow(trail, frame.now, frame.tempo);
    const night = frame.light.additive;
    const look = night ? NIGHT : DAY;
    const alpha = look.alpha * fade;
    const point = (at: number): [number, number] => [
      trail.x0 + (trail.x1 - trail.x0) * at,
      trail.y0 + (trail.y1 - trail.y0) * at,
    ];
    for (let index = 0; index < SEGMENTS; index += 1) {
      const from = point((grow * index) / SEGMENTS);
      const to = point((grow * (index + 1)) / SEGMENTS);
      const { opacity, hue, head } = shade((index + 0.5) / SEGMENTS);
      const lightness = look.lightness + (look.head - look.lightness) * head;
      const color = hsl(trail.hue + hue, look.saturation, lightness);
      trails.moveTo(...from).lineTo(...to);
      trails.stroke({ width: look.width, color, alpha: alpha * opacity });
      if (night) {
        for (const halo of HALOS) {
          halos.moveTo(...from).lineTo(...to);
          halos.stroke({
            width: halo.width,
            color: hsl(trail.hue, 0.9, 0.7),
            alpha: alpha * opacity * halo.alpha,
          });
        }
      }
    }
    for (const curl of trail.curls) {
      if (grow < curl.at) {
        continue;
      }
      const [x, y] = point(curl.at);
      const start = curl.side > 0 ? Math.PI : 0;
      trails.moveTo(x, y);
      trails.arc(
        x + curl.radius * curl.side,
        y,
        curl.radius,
        start,
        start + 1.2 * Math.PI * curl.side,
        curl.side < 0,
      );
      trails.stroke({
        width: 1,
        color: hsl(trail.hue + 40, look.saturation, look.lightness),
        alpha: alpha * 0.6,
      });
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      root.visible = ctx.decors.get(state.setId) === 'ambyss';
      if (!root.visible) {
        return;
      }
      const center = { x: state.arena.width / 2, y: state.arena.height / 2 };
      veils.position.set(center.x, center.y);
      if (frame.fraction !== lookedAt) {
        lookedAt = frame.fraction;
        veilLook = veilLookAt(frame.fraction);
      }
      for (const [index, veil] of veilsAt(frame.now, frame.tempo, frame.calm).entries()) {
        const sheet = sheets[index];
        if (sheet !== undefined) {
          sheet.position.set(veil.offset, 0);
          sheet.width = veil.halfWidth * 2;
          sheet.height = VEIL_LENGTH;
          sheet.tint = veilLook.tones[veil.tone];
          sheet.alpha = veilLook.alpha;
        }
      }
      trails.clear();
      halos.clear();
      if (frame.calm) {
        return;
      }
      for (const trail of trailsAt(state.seed, frame.now, frame.tempo, center)) {
        drawTrail(trail, frame);
      }
    },
    destroy(): void {
      root.destroy({ children: true });
      band.texture.destroy(true);
    },
  };
}
