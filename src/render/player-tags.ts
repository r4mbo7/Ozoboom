import type { Container, Sprite } from 'pixi.js';
import type { PlayerId, PlayerState, SimEvent } from '../sim/state';
import { defaultName } from '../shared/i18n';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { add, setTint } from './util';

const REVIVE_GRACE = 3;
const REVIVED_TICKS = 2 * TICKS_PER_BEAT;
const NAME_GAP = 3;
const NAME_ALPHA = { standing: 1, downed: 0.9 };

interface Revive {
  progress: number;
  tick: number;
  revivedTick: number;
}

// What the sim reported about each relève: its progress, and the tick it ended.
export class ReviveLog {
  private readonly items = new Map<PlayerId, Revive>();

  onEvent(event: SimEvent, tick: number): void {
    if (event.type === 'playerReviving') {
      const revive = this.of(event.playerId);
      revive.progress = event.progress;
      revive.tick = tick;
    } else if (event.type === 'playerRevived') {
      const revive = this.of(event.playerId);
      revive.progress = 0;
      revive.tick = Number.NEGATIVE_INFINITY;
      revive.revivedTick = tick;
    }
  }

  // The share of the relève done, while it keeps being reported, and only for a player lying down.
  share(id: PlayerId, downed: boolean, now: number): number {
    const revive = this.items.get(id);
    if (revive === undefined || !downed || now - revive.tick > REVIVE_GRACE) {
      return 0;
    }
    return Math.min(1, Math.max(0, revive.progress));
  }

  // 0 when the halo of the revival opens, 1 once it is gone.
  burst(id: PlayerId, now: number): number {
    const revive = this.items.get(id);
    return revive === undefined
      ? 1
      : Math.min(1, Math.max(0, (now - revive.revivedTick) / REVIVED_TICKS));
  }

  clear(): void {
    this.items.clear();
  }

  private of(id: PlayerId): Revive {
    let revive = this.items.get(id);
    if (revive === undefined) {
      revive = {
        progress: 0,
        tick: Number.NEGATIVE_INFINITY,
        revivedTick: Number.NEGATIVE_INFINITY,
      };
      this.items.set(id, revive);
    }
    return revive;
  }
}

// What a player carries besides the body: the name above, the halo of a revival.
export class PlayerTag {
  private readonly nameEdge: Sprite;
  private readonly name: Sprite;
  private readonly burst: Sprite;

  private readonly ctx: RenderContext;

  constructor(ctx: RenderContext, tags: Container) {
    const { textures, layers } = ctx;
    this.ctx = ctx;
    this.burst = add(layers.glow, textures.halo);
    this.nameEdge = add(tags, textures.halo);
    this.name = add(tags, textures.halo);
  }

  hide(): void {
    this.burst.visible = this.name.visible = this.nameEdge.visible = false;
  }

  // `reach` is how far the body extends, in world units, above its center. Gives the top of what it
  // draws above the player.
  place(
    player: PlayerState,
    x: number,
    y: number,
    reach: number,
    color: number,
    burst: number,
    frame: Frame,
    team: boolean,
  ): number {
    this.placeBurst(player, x, y, color, burst, frame);
    return this.placeName(player, x, y, reach, color, frame, team);
  }

  private placeBurst(
    player: PlayerState,
    x: number,
    y: number,
    color: number,
    progress: number,
    frame: Frame,
  ): void {
    const { burst } = this;
    burst.visible = progress < 1;
    if (!burst.visible) {
      return;
    }
    const { halo } = this.ctx.textures;
    const grow = frame.calm ? 0.5 : progress;
    setTint(burst, color);
    burst.position.set(x, y);
    burst.scale.set((player.radius * (3 + 3 * grow)) / halo.radius);
    burst.alpha =
      frame.light.haloAlpha * (frame.calm ? 0.6 : 1.4) * (1 - progress) * (1 - progress);
  }

  private placeName(
    player: PlayerState,
    x: number,
    y: number,
    reach: number,
    color: number,
    frame: Frame,
    team: boolean,
  ): number {
    const { name, nameEdge } = this;
    const label =
      player.name !== undefined && player.name !== ''
        ? player.name
        : team
          ? defaultName(player.id)
          : null;
    name.visible = nameEdge.visible = label !== null;
    if (label === null) {
      return y - reach;
    }
    const { light, palette, camera } = frame;
    const texts = this.ctx.textures.names.get(label);
    if (name.texture !== texts.fill) {
      name.texture = texts.fill;
      nameEdge.texture = texts.edge;
    }
    const size = 1 / (NAME_TEXTURE_SCALE * camera.scale);
    const above = reach + (texts.fill.height / NAME_TEXTURE_SCALE / 2 + NAME_GAP) / camera.scale;
    const fade = player.downed ? NAME_ALPHA.downed : NAME_ALPHA.standing;
    name.position.set(x, y - above);
    nameEdge.position.set(x, y - above);
    name.scale.set(size);
    nameEdge.scale.set(size);
    setTint(name, color);
    setTint(nameEdge, light.additive ? palette.sol : palette.texte);
    name.alpha = fade;
    nameEdge.alpha = (light.additive ? 0.7 : 0.9) * fade;
    return y - above - texts.fill.height / NAME_TEXTURE_SCALE / 2 / camera.scale;
  }
}
