import type { Graphics } from 'pixi.js';
import { hash } from './hash';
import { mixColor } from './palette';

// The grey of a repair lost on a full stage.
export const LOST_GREY = 0xa7abb8;
const SPARK_LIGHT = 0xd4d7e0;
const SPARK_DARK = 0x80848f;
const SPARKS = 18;
// In drawn units per beat², the drawn stage being 31 units wide.
const FALL = 90;

// Sparks thrown back off the full stage toward the cable, in drawn units per beat.
const GREY_SPARKS = Array.from({ length: SPARKS }, (_, index) => ({
  spread: (hash(index, 4) - 0.5) * 2.4,
  speed: 50 + hash(index, 5) * 55,
  life: 1 + hash(index, 6) * 0.6,
  color: mixColor(SPARK_LIGHT, SPARK_DARK, hash(index, 7)),
}));

// The sparks `since` beats after the bolt bounced off the ring at `impact`, falling as they fade.
export function drawSpray(
  graphics: Graphics,
  impact: { x: number; y: number },
  toward: number,
  since: number,
  scale: number,
): void {
  for (const spark of GREY_SPARKS) {
    if (since < 0 || since >= spark.life) {
      continue;
    }
    const age = since / spark.life;
    const angle = toward + spark.spread;
    const vx = Math.cos(angle) * spark.speed;
    const vy = Math.sin(angle) * spark.speed - 10;
    const x = impact.x + vx * since * scale;
    const y = impact.y + (vy * since + 0.5 * FALL * since * since) * scale;
    const fallY = vy + FALL * since;
    const norm = Math.hypot(vx, fallY) || 1;
    const length = (8 * (1 - age) + 1.5) * scale;
    graphics
      .moveTo(x, y)
      .lineTo(x - (vx / norm) * length, y - (fallY / norm) * length)
      .stroke({
        width: (2.2 * (1 - age) + 0.8) * scale,
        color: spark.color,
        alpha: 1 - age * age,
        cap: 'round',
      });
  }
}
