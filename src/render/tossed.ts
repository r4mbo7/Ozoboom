import { Container, type Sprite } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { EnemyState, EntityId } from '../sim/state';
import type { Shape } from './paint';
import { add, setTint } from './util';
import { ViewPool } from './views';

export type TossFlight = NonNullable<EnemyState['tossed']>;

// Its arc rises a share of the way it flies, never under `least`, and it grows as it nears the eye.
const ARC = { share: 0.3, least: 22, swell: 1 / 120 } as const;
// Its shadow stays on the ground, smaller and fainter the higher it flies.
const SHADOW = { width: 1, height: 0.5, alpha: 0.6, fade: 1 / 70, least: 0.4 } as const;

export interface TossedAt {
  // Where it is on the ground, under it.
  x: number;
  y: number;
  height: number;
  // 0 as it leaves the ground, 1 as it lands.
  share: number;
}

// A thrown bad vibe at `now`: on the line from where it left to where it lands, up in an arc. The
// time, not the sim's last two positions, places it, so it touches the ground as its flight ends.
export function tossedAt(flight: TossFlight, now: number, into: TossedAt): TossedAt {
  const share = clamp01((now - flight.startTick) / Math.max(1, flight.landTick - flight.startTick));
  const length = Math.hypot(flight.toX - flight.fromX, flight.toY - flight.fromY);
  into.x = lerp(flight.fromX, flight.toX, share);
  into.y = lerp(flight.fromY, flight.toY, share);
  into.height = Math.max(ARC.least, ARC.share * length) * Math.sin(Math.PI * share);
  into.share = share;
  return into;
}

export function createTossedAt(): TossedAt {
  return { x: 0, y: 0, height: 0, share: 0 };
}

// Thrown bad vibes up in their arcs, and their shadows on the ground, made with the first throw.
export class Tosses {
  private readonly shadows: ViewPool<Sprite>;
  private readonly halo: Shape;
  private readonly flown = createTossedAt();

  // Its shadows go under all that `parent` will hold.
  constructor(parent: Container, halo: Shape) {
    this.halo = halo;
    const ground = parent.addChild(new Container());
    this.shadows = new ViewPool(
      () => {
        const shadow = add(ground, halo);
        setTint(shadow, 0x000000);
        return shadow;
      },
      (shadow) => {
        shadow.visible = false;
      },
    );
  }

  begin(): void {
    this.shadows.begin();
  }

  // Where a bad vibe in flight is at `now`, until the next call; null on the ground.
  at(enemy: Pick<EnemyState, 'tossed'>, now: number): TossedAt | null {
    return enemy.tossed === undefined ? null : tossedAt(enemy.tossed, now, this.flown);
  }

  // The sprite stands on the ground at `at`: it goes up, grows as it nears the eye and turns once
  // over its flight, so that it lands as it left.
  lift(id: EntityId, sprite: Sprite, at: TossedAt, radius: number, calm: boolean): void {
    sprite.y -= at.height;
    sprite.scale.set(
      sprite.scale.x * (1 + at.height * ARC.swell),
      sprite.scale.y * (1 + at.height * ARC.swell),
    );
    sprite.rotation += calm ? 0 : at.share * 2 * Math.PI;
    const shadow = this.shadows.acquire(id);
    const shrink = Math.max(SHADOW.least, 1 - at.height * SHADOW.fade);
    shadow.visible = true;
    shadow.position.set(at.x, at.y);
    shadow.scale.set(
      (radius * SHADOW.width * shrink) / this.halo.radius,
      (radius * SHADOW.height * shrink) / this.halo.radius,
    );
    shadow.alpha = SHADOW.alpha * shrink;
  }

  end(): void {
    this.shadows.end();
  }
}
