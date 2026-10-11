import { Container, Graphics, Sprite } from 'pixi.js';
import { momentAt } from '../shared/palette';
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
  VEIL_LOOKS,
  veilsAt,
} from './cosmic-filter';
import type { Frame } from './frame';
import { WHITE, paint } from './paint';
import { parseHexColor } from './palette';
import { setTint } from './util';

const SEGMENTS = 8;
const NIGHT = { saturation: 0.95, lightness: 0.82, head: 0.94, alpha: 0.85, width: 1.6 };
const DAY = { saturation: 0.7, lightness: 0.38, head: 0.38, alpha: 0.7, width: 1.85 };
const HALOS = [
  { width: 7, alpha: 0.12 },
  { width: 3.5, alpha: 0.28 },
];

interface Slot {
  readonly line: Graphics;
  readonly glow: Graphics;
  grown: boolean;
}

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
  const halos = new Container();
  halos.blendMode = 'add';
  const lines = new Container();
  root.addChild(veils, halos, lines);
  const slots: Slot[] = [];

  let lookedAt = Number.NaN;
  let tones: readonly [number, number] = [0xffffff, 0xffffff];
  let veilAlpha = 0;
  let liveKey = '';
  let live: Trail[] = [];

  function drawTrail({ line, glow }: Slot, trail: Trail, grow: number, night: boolean): void {
    line.clear();
    glow.clear();
    const look = night ? NIGHT : DAY;
    const { alpha } = look;
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
      line.moveTo(...from).lineTo(...to);
      line.stroke({ width: look.width, color, alpha: alpha * opacity });
      if (night) {
        for (const halo of HALOS) {
          glow.moveTo(...from).lineTo(...to);
          glow.stroke({
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
      line.moveTo(x, y);
      line.arc(
        x + curl.radius * curl.side,
        y,
        curl.radius,
        start,
        start + 1.2 * Math.PI * curl.side,
        curl.side < 0,
      );
      line.stroke({
        width: 1,
        color: hsl(trail.hue + 40, look.saturation, look.lightness),
        alpha: alpha * 0.6,
      });
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      root.visible = frame.set.decor === 'ambyss';
      if (!root.visible) {
        return;
      }
      const center = { x: state.arena.width / 2, y: state.arena.height / 2 };
      veils.position.set(center.x, center.y);
      if (frame.fraction !== lookedAt) {
        lookedAt = frame.fraction;
        const look = momentAt(VEIL_LOOKS, frame.fraction);
        tones = [parseHexColor(look.tone0), parseHexColor(look.tone1)];
        veilAlpha = look.alpha;
      }
      for (const [index, veil] of veilsAt(frame.now, frame.tempo, frame.calm).entries()) {
        const sheet = sheets[index];
        if (sheet !== undefined) {
          sheet.position.set(veil.offset, 0);
          sheet.width = veil.halfWidth * 2;
          sheet.height = VEIL_LENGTH;
          setTint(sheet, tones[veil.tone]);
          sheet.alpha = veilAlpha;
        }
      }
      lines.visible = halos.visible = !frame.calm;
      if (frame.calm) {
        return;
      }
      // The trails alive only change on the beat; a trail once grown is only faded.
      const { tempo } = frame;
      const night = frame.light.additive;
      const beat = Math.floor(frame.now / tempo.ticksPerBeat);
      const key = `${String(state.seed)} ${String(center.x)} ${String(center.y)} ${String(tempo.ticksPerBeat)} ${String(beat)} ${String(night)}`;
      if (key !== liveKey) {
        liveKey = key;
        live = trailsAt(state.seed, frame.now, tempo, center);
        while (slots.length < live.length) {
          slots.push({
            line: lines.addChild(new Graphics()),
            glow: halos.addChild(new Graphics()),
            grown: false,
          });
        }
        for (const [index, slot] of slots.entries()) {
          slot.line.visible = slot.glow.visible = index < live.length;
          slot.grown = false;
        }
      }
      for (const [index, trail] of live.entries()) {
        const slot = slots[index];
        if (slot === undefined) {
          continue;
        }
        const { grow, fade } = trailGlow(trail, frame.now, tempo);
        if (!slot.grown) {
          drawTrail(slot, trail, grow, night);
          slot.grown = grow >= 1;
        }
        slot.line.alpha = slot.glow.alpha = fade;
      }
    },
    destroy(): void {
      root.destroy({ children: true });
      band.texture.destroy(true);
    },
  };
}
