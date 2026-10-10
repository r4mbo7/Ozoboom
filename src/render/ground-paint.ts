import { CanvasSource, Texture } from 'pixi.js';
import { nextFloat, seedRng } from '../shared/prng';
import { TAU, WHITE, glow, paint, type Shape } from './paint';

function tile(size: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  draw(ctx);
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  source.style.addressMode = 'repeat';
  return new Texture({ source });
}

// Dry grass: short strokes, thin and scattered, tinted straw by the caller.
export function grainTile(seed: number): Texture {
  const size = 256;
  return tile(size, (ctx) => {
    const rng = seedRng(seed >>> 0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1.2;
    for (let index = 0; index < 340; index += 1) {
      const x = nextFloat(rng) * size;
      const y = nextFloat(rng) * size;
      const angle = -Math.PI / 2 + (nextFloat(rng) - 0.5) * 1.6;
      const length = 3 + nextFloat(rng) * 5;
      ctx.globalAlpha = 0.25 + nextFloat(rng) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
  });
}

// Wide soft patches, the lighter tufts of the lawn, wrapped so the tile repeats without a seam.
export function patchTile(seed: number): Texture {
  const size = 512;
  return tile(size, (ctx) => {
    const rng = seedRng((seed + 7919) >>> 0);
    for (let index = 0; index < 22; index += 1) {
      const x = nextFloat(rng) * size;
      const y = nextFloat(rng) * size;
      const radius = 40 + nextFloat(rng) * 70;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
          gradient.addColorStop(0, 'rgb(255 255 255 / 0.5)');
          gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
        }
      }
    }
  });
}

export function crown(): Shape {
  const radius = 48;
  return paint(radius * 2 + 8, radius * 2 + 8, radius, (ctx) => {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
    ctx.beginPath();
    ctx.arc(radius * 0.22, radius * 0.18, radius * 0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.18)';
    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.3, radius * 0.38, 0, TAU);
    ctx.fill();
  });
}

// Drawn centred; the caller anchors its start on the foot of the tree and stretches it in x.
export function shadow(): Shape {
  const width = 128;
  const height = 96;
  return paint(width, height, 1, (ctx) => {
    glow(ctx, WHITE, 10);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2 - 14, height / 2 - 14, 0, 0, TAU);
    ctx.fill();
  });
}

export function crownRim(): Shape {
  const radius = 48;
  return paint(radius * 2 + 8, radius * 2 + 8, radius, (ctx) => {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1.5, 0, TAU);
    ctx.stroke();
  });
}

// Fine dots of sand, round and short, tinted by the caller.
export function sandTile(seed: number): Texture {
  const size = 256;
  return tile(size, (ctx) => {
    const rng = seedRng((seed + 104729) >>> 0);
    ctx.fillStyle = WHITE;
    for (let index = 0; index < 900; index += 1) {
      ctx.globalAlpha = 0.2 + nextFloat(rng) * 0.6;
      ctx.beginPath();
      ctx.arc(
        nextFloat(rng) * size,
        nextFloat(rng) * size,
        0.5 + nextFloat(rng) * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  });
}
