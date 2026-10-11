import type { Sprite } from 'pixi.js';
import { TICKS_PER_BEAT, isBarTick } from '../shared/tempo';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { POLE_HEIGHT } from './textures-weapons';
import { type Piece, SIZES, type WeaponKit } from './weapon-kit';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const TOTEM_PX = 76;
const TOTEM_TOP = -(POLE_HEIGHT / 2 + 12);
const TOTEM_FOOT = POLE_HEIGHT / 2 + 1;

interface PlacedView {
  readonly piece: Piece;
  readonly zone: Sprite;
  readonly shadow: Sprite;
}

export interface GroundFamily extends Pick<Family, 'update'> {
  // Rings drawn on bad vibes that carry a mark.
  readonly marks: number;
}

// What stays on the ground: plates and totems the sim keeps in `placed`, and the ring of a mark.
export function createGround(ctx: RenderContext, kit: WeaponKit): GroundFamily {
  const { textures: t, layers } = ctx;
  const w = t.weapons;
  const placed = new ViewPool<PlacedView>(
    () => ({ piece: kit.piece(), zone: kit.ground(w.zone), shadow: kit.ground(w.shadow) }),
    (view) => {
      kit.hidePiece(view.piece);
      hide(view.zone, view.shadow);
    },
  );
  const marks = new ViewPool<Sprite>(
    () => add(layers.fx, w.dash),
    (sprite) => {
      hide(sprite);
    },
  );
  let marked = 0;
  let lastTick = -1;

  function drawPlaced(state: SimState, alpha: number, frame: Frame): void {
    placed.begin();
    for (const entry of state.placed ?? []) {
      const look = kit.style(entry.weaponId);
      const view = placed.acquire(entry.id);
      const color = frame.palette[look.token];
      const x = lerp(entry.prevX, entry.x, alpha);
      const y = lerp(entry.prevY, entry.y, alpha);
      const fade = frame.calm ? 1 : Math.min(1, entry.ticksLeft / TICKS_PER_BEAT);
      const { zone, shadow } = view;
      zone.visible = true;
      setTint(zone, color);
      zone.position.set(x, y);
      zone.rotation = frame.calm ? 0 : frame.now * 0.012;
      zone.scale.set(entry.radius / w.zone.radius);
      zone.alpha = 0.5 * fade;
      shadow.visible = true;
      shadow.position.set(x, y + 2);
      shadow.alpha = fade;
      if (look.kind === 'totem') {
        const scale = (TOTEM_PX * look.scale) / (TOTEM_FOOT - TOTEM_TOP);
        const shape = w.icons.totem;
        shadow.scale.set(((TOTEM_PX / 2) * look.scale) / w.shadow.radius / 2);
        kit.place(
          view.piece,
          shape,
          {
            x,
            y: y - TOTEM_FOOT * scale,
            size: scale * shape.radius * 2,
            alpha: fade,
            haloY: (TOTEM_TOP + 9) * scale,
          },
          color,
          frame,
        );
      } else {
        const size = (SIZES[look.kind] ?? 24) * look.scale;
        shadow.scale.set(size / w.shadow.radius / 2);
        kit.place(
          view.piece,
          w.icons[look.kind],
          { x, y, size, rotation: frame.calm ? 0 : frame.now * 0.12, alpha: fade },
          color,
          frame,
        );
      }
    }
    placed.end();
  }

  // The totem pushes back on each bar, with no event of its own: the wave starts from the state.
  function wave(state: SimState, frame: Frame): void {
    if (state.tick === lastTick) {
      return;
    }
    lastTick = state.tick;
    if (!isBarTick(state.tick, frame.tempo)) {
      return;
    }
    for (const entry of state.placed ?? []) {
      const look = kit.style(entry.weaponId);
      if (look.kind === 'totem') {
        kit.transients.spawn({
          shape: t.ring,
          now: state.tick,
          duration: TICKS_PER_BEAT * 0.9,
          x: entry.x,
          y: entry.y,
          fromRadius: entry.radius * 0.2,
          toRadius: entry.radius,
          tint: frame.palette[look.token],
          peak: frame.calm ? 0.5 : 0.9,
        });
      }
    }
  }

  function drawMarks(state: SimState, alpha: number, frame: Frame): void {
    marks.begin();
    marked = 0;
    for (const enemy of state.enemies) {
      if (!enemy.marked) {
        continue;
      }
      marked += 1;
      const sprite = marks.acquire(enemy.id);
      sprite.visible = true;
      setTint(sprite, frame.palette.or);
      sprite.position.set(lerp(enemy.prevX, enemy.x, alpha), lerp(enemy.prevY, enemy.y, alpha));
      sprite.rotation = frame.calm ? 0 : frame.now * 0.05 + enemy.id;
      sprite.scale.set((enemy.radius * 1.5 + 5) / w.dash.radius);
      sprite.alpha = 0.9 * frame.light.haloAlpha + 0.1;
    }
    marks.end();
  }

  return {
    get marks(): number {
      return marked;
    },
    update(state, alpha, frame) {
      wave(state, frame);
      drawPlaced(state, alpha, frame);
      drawMarks(state, alpha, frame);
    },
  };
}
