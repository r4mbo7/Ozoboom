import { BufferImageSource, Mesh, MeshGeometry, type Shader, Texture } from 'pixi.js';
import { clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import { TAU } from './paint';
import { WHITE, mixColor } from './palette';
import { DRAWN_RADIUS, OUTLINE, type PoweredBody, hueAt } from './potion-aura-model';

const UP = -Math.PI / 2;
const ROOTS = { along: 0.6, across: 0.95, rows: 16 };

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

interface Tongue {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootAngle: number;
  readonly length: number;
  readonly width: number;
  readonly shift: number;
  readonly phase: number;
  readonly flickerPhase: number;
  readonly flicker: number;
}

function seeded(index: number): number {
  return frac(Math.sin(index * 12.9898 + 4.1414) * 43758.5453);
}

const TONGUES: readonly Tongue[] = [
  { offset: 0.5, length: 21, width: 3.2, shift: 0 },
  { offset: 0, length: 12, width: 2.4, shift: Math.PI },
].flatMap((row, rowIndex) =>
  Array.from({ length: ROOTS.rows }, (_, index): Tongue => {
    const seed = (rowIndex * ROOTS.rows + index) * 4;
    const root = Math.PI + ((index + row.offset) * TAU) / ROOTS.rows;
    return {
      rootX: Math.cos(root) * ROOTS.along,
      rootY: Math.sin(root) * ROOTS.across,
      rootAngle: Math.atan2(Math.sin(root) / ROOTS.across, Math.cos(root) / ROOTS.along),
      length: row.length * (0.85 + 0.3 * seeded(seed)),
      width: row.width,
      shift: row.shift,
      phase: seeded(seed + 1) * TAU,
      flickerPhase: seeded(seed + 2) * TAU,
      flicker: 0.4 + 0.25 * seeded(seed + 3),
    };
  }),
);
const TONGUE_STEPS = 10;
const TONGUE_POINTS = 2 * (TONGUE_STEPS + 1);
const PALETTE = { columns: 48, rows: 4 };
const TONGUE_LAYERS = [
  { length: 1, width: 1, grow: 0.45, row: 0 },
  { length: 1, width: 1, grow: 0, row: 1 },
  { length: 0.68, width: 0.55, grow: 0, row: 2 },
  { length: 0.38, width: 0.3, grow: 0, row: 3 },
] as const;
const PALETTE_TONES = [-1, 0, 0.45, 0.82] as const;

export function paletteTexture(): Texture {
  const { columns, rows } = PALETTE;
  const data = new Uint8Array(columns * rows * 4);
  for (let row = 0; row < rows; row += 1) {
    const tone = PALETTE_TONES[row] ?? 0;
    for (let column = 0; column < columns; column += 1) {
      const hue = hueAt((column / columns) * TAU, 0);
      const color = tone < 0 ? OUTLINE.color : mixColor(hue, WHITE, tone);
      data.set(
        [color >> 16, (color >> 8) & 0xff, color & 0xff, 0xff],
        (row * columns + column) * 4,
      );
    }
  }
  const source = new BufferImageSource({ resource: data, width: columns, height: rows });
  source.scaleMode = 'nearest';
  return new Texture({ source });
}

export class FlameMesh {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  private readonly geometry: MeshGeometry;
  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private written = 0;

  constructor(palette: Texture) {
    const shapes = TONGUES.length * TONGUE_LAYERS.length;
    this.positions = new Float32Array(shapes * TONGUE_POINTS * 2);
    this.uvs = new Float32Array(shapes * TONGUE_POINTS * 2);
    const indices = new Uint32Array(shapes * TONGUE_STEPS * 6);
    for (let shape = 0; shape < shapes; shape += 1) {
      for (let step = 0; step < TONGUE_STEPS; step += 1) {
        const at = shape * TONGUE_POINTS + 2 * step;
        indices.set(
          [at, at + 1, at + 2, at + 1, at + 3, at + 2],
          (shape * TONGUE_STEPS + step) * 6,
        );
      }
    }
    this.geometry = new MeshGeometry({ positions: this.positions, uvs: this.uvs, indices });
    this.mesh = new Mesh({ geometry: this.geometry, texture: palette });
  }

  draw(body: PoweredBody, beats: number, turn: number): void {
    const unit = body.radius / DRAWN_RADIUS;
    const { facing, heading, moving, reach, radius } = body;
    const [cos, sin] = [Math.cos(facing), Math.sin(facing)];
    this.written = 0;
    for (const tongue of TONGUES) {
      const { rootX, rootY } = tongue;
      const angle = facing + tongue.rootAngle;
      const x0 = body.x + (rootX * cos - rootY * sin) * radius - Math.cos(angle) * 1.5 * unit;
      const y0 = body.y + (rootX * sin + rootY * cos) * radius - Math.sin(angle) * 1.5 * unit;
      const backStill = (1 - Math.cos(angle - facing)) / 2;
      const backRun = (1 - Math.cos(angle - heading)) / 2;
      const upness = (1 + Math.cos(wrapAngle(UP - angle))) / 2;
      const still = tongue.length * (0.42 + 0.58 * backStill) * (0.6 + 0.65 * upness);
      const run = tongue.length * (0.22 + 1.95 * backRun ** 1.4);
      const flicker =
        1 +
        0.12 * Math.sin(beats * TAU * tongue.flicker + tongue.flickerPhase) +
        0.05 * Math.sin(beats * TAU * 1.3 + tongue.phase);
      const length = lerp(still, run, moving) * reach * flicker * unit;
      const bend = lerp(
        1.05 * Math.sin(wrapAngle(UP - angle)),
        wrapAngle(heading + Math.PI - angle),
        moving,
      );
      const wave = lerp(0.5, 0.26, moving);
      const width = tongue.width * (1 + 0.25 * backRun * moving) * unit;
      const column = Math.floor(frac((angle + tongue.shift - turn) / TAU) * PALETTE.columns);
      for (const layer of TONGUE_LAYERS) {
        const grow = layer.grow * unit;
        this.writeTongue(
          x0,
          y0,
          angle,
          bend,
          length * layer.length + 2 * grow,
          width * layer.width + grow,
          wave,
          tongue.phase,
          beats,
          (column + 0.5) / PALETTE.columns,
          (layer.row + 0.5) / PALETTE.rows,
        );
      }
    }
    this.geometry.getBuffer('aPosition').update();
    this.geometry.getBuffer('aUV').update();
    this.mesh.alpha = body.alpha;
  }

  // Its mesh goes with the players' layer: only its buffers are left.
  destroy(): void {
    this.geometry.destroy();
  }

  private writeTongue(
    x0: number,
    y0: number,
    angle: number,
    bend: number,
    length: number,
    width: number,
    wave: number,
    phase: number,
    beats: number,
    u: number,
    v: number,
  ): void {
    const { positions, uvs } = this;
    let x = x0;
    let y = y0;
    let at = this.written * 2;
    const step = length / TONGUE_STEPS;
    for (let j = 0; j <= TONGUE_STEPS; j += 1) {
      const share = j / TONGUE_STEPS;
      const phi =
        angle +
        bend * smoothstep(clamp01(share * 1.7)) +
        wave * Math.sin(TAU * (share * 1.1 - beats * 0.55) + phase) * Math.min(1, share * 2.5);
      const half = width * (1 - share) ** 0.9 * (1 + 0.22 * Math.sin(Math.PI * share));
      const nx = -Math.sin(phi) * half;
      const ny = Math.cos(phi) * half;
      positions[at] = x + nx;
      positions[at + 1] = y + ny;
      positions[at + 2] = x - nx;
      positions[at + 3] = y - ny;
      uvs[at] = uvs[at + 2] = u;
      uvs[at + 1] = uvs[at + 3] = v;
      at += 4;
      x += Math.cos(phi) * step;
      y += Math.sin(phi) * step;
    }
    this.written += TONGUE_POINTS;
  }
}
