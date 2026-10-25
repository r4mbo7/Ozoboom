import { type Container, Graphics, type Sprite } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import type { EntityId, PlayerId } from '../sim/state';
import {
  type CablePath,
  PEARLS,
  type Point,
  type Target,
  alongCable,
  assignCables,
  cablePath,
  cableReach,
  pearlAt,
} from './batterie-moments';
import { MASK_BODY, maskTone } from './face-kit';
import type { Frame } from './frame';
import type { Shape } from './paint';
import { mixColor } from './palette';
import { add, setTint } from './util';

export type Shine = Target & { readonly token: PaletteToken } & (
    | { readonly kind: 'player'; readonly id: PlayerId }
    | { readonly kind: 'trap'; readonly id: EntityId }
  );

export interface Plugged {
  readonly shine: Shine;
  readonly reach: number;
}

export type CableMode = 'drain' | 'give' | 'off';

export interface CableRun {
  readonly boss: Point;
  readonly sockets: readonly Point[];
  readonly reach: number;
  readonly maskUnit: number;
  readonly beats: number;
  readonly mode: CableMode;
}

export interface Cables {
  update(run: CableRun, shines: readonly Shine[], frame: Frame): readonly Plugged[];
  hide(): void;
}

interface Slot {
  shine: Shine | null;
  x: number;
  y: number;
  since: number;
  leftAt: number | null;
}

const DRAINED_PEARL = 0x8f95ad;
export const PEARL = 2.6;
const LINE = { rim: 8, core: 4.4, plug: 5, plugRim: 2.4, samples: 24 };

export function createCables(
  lines: Container,
  dots: Container,
  pearl: Shape,
  calmPearl: Shape,
): Cables {
  const graphics = lines.addChild(new Graphics());
  const slots: Slot[] = [];
  const pearls: Sprite[] = [];
  const held: Plugged[] = [];

  function slotAt(index: number): Slot {
    while (slots.length <= index) {
      slots.push({ shine: null, x: 0, y: 0, since: 0, leftAt: null });
      for (let count = 0; count < PEARLS; count += 1) {
        pearls.push(add(dots, pearl));
      }
    }
    const slot = slots[index];
    if (slot === undefined) {
      throw new Error('Cable slot is missing');
    }
    return slot;
  }

  function reachOf(slot: Slot, beats: number): number {
    const out = cableReach(beats - slot.since, false);
    if (slot.leftAt === null) {
      return out;
    }
    return Math.min(
      cableReach(slot.leftAt - slot.since, false),
      cableReach(beats - slot.leftAt, true),
    );
  }

  function plug(run: CableRun, shines: readonly Shine[]): void {
    const kept = run.sockets.map((_, index) => {
      const slot = slotAt(index);
      return slot.leftAt === null ? (slot.shine?.key ?? null) : null;
    });
    const keys = run.mode === 'drain' ? assignCables(run.boss, run.reach, shines, kept) : kept;
    keys.forEach((key, index) => {
      const slot = slotAt(index);
      if (run.mode === 'off' || key === null) {
        if (slot.shine !== null && slot.leftAt === null) {
          slot.leftAt = run.beats;
        }
        return;
      }
      const shine = shines.find((candidate) => candidate.key === key);
      if (shine === undefined) {
        return;
      }
      if (slot.shine?.key !== key || slot.leftAt !== null) {
        slot.since = run.beats;
        slot.leftAt = null;
      }
      slot.shine = shine;
      slot.x = shine.x;
      slot.y = shine.y;
    });
  }

  function trace(path: CablePath, reach: number): void {
    const count = Math.max(1, Math.ceil(LINE.samples * reach));
    graphics.moveTo(path[0], path[1]);
    for (let index = 1; index <= count; index += 1) {
      const [x, y] = alongCable(path, (index / count) * reach);
      graphics.lineTo(x, y);
    }
  }

  function draw(slot: Slot, index: number, reach: number, run: CableRun, frame: Frame): void {
    const socket = run.sockets[index];
    if (slot.shine === null || socket === undefined) {
      return;
    }
    const rim = frame.palette.badVibeRim;
    const core = maskTone(rim, MASK_BODY);
    const path = cablePath(socket, [slot.x, slot.y], index, run.beats, run.maskUnit);
    trace(path, reach);
    graphics.stroke({ width: LINE.rim * run.maskUnit, color: rim, cap: 'round', join: 'round' });
    trace(path, reach);
    graphics.stroke({ width: LINE.core * run.maskUnit, color: core, cap: 'round', join: 'round' });
    if (reach < 1) {
      return;
    }
    graphics
      .circle(slot.x, slot.y, LINE.plug * run.maskUnit)
      .fill({ color: core })
      .stroke({ width: LINE.plugRim * run.maskUnit, color: rim });
    const color = frame.palette[slot.shine.token];
    const shape = frame.calm ? calmPearl : pearl;
    for (let count = 0; count < PEARLS; count += 1) {
      const sprite = pearls[index * PEARLS + count];
      if (sprite === undefined) {
        continue;
      }
      const p = pearlAt(run.beats, count, index, run.mode !== 'drain');
      const [x, y] = alongCable(path, p);
      sprite.visible = true;
      sprite.texture = shape.texture;
      setTint(sprite, run.mode === 'drain' ? mixColor(color, DRAINED_PEARL, 1 - p) : color);
      sprite.position.set(x, y);
      sprite.scale.set((PEARL * run.maskUnit) / shape.radius);
    }
  }

  return {
    update(run, shines, frame): readonly Plugged[] {
      plug(run, shines);
      graphics.clear();
      held.length = 0;
      for (const sprite of pearls) {
        sprite.visible = false;
      }
      slots.forEach((slot, index) => {
        if (slot.shine === null) {
          return;
        }
        const reach = reachOf(slot, run.beats);
        if (slot.leftAt !== null && reach <= 0) {
          slot.shine = null;
          slot.leftAt = null;
          return;
        }
        if (slot.leftAt === null) {
          held.push({ shine: slot.shine, reach });
        }
        if (reach > 0) {
          draw(slot, index, reach, run, frame);
        }
      });
      return held;
    },
    hide(): void {
      graphics.clear();
      for (const sprite of pearls) {
        sprite.visible = false;
      }
      for (const slot of slots) {
        slot.shine = null;
        slot.leftAt = null;
      }
    },
  };
}
