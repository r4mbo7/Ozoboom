import { Container, type Sprite } from 'pixi.js';
import type { PlayerId, PlayerState, SimEvent } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { add, setTint } from './util';

const TAU = Math.PI * 2;
const BEADS = 24;
const RING_TEXTURE_REACH = 54;
const RING_SHARE = 3;
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

  // The ring fills while the progress keeps being reported, and only for a player lying down.
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

interface Ring {
  readonly container: Container;
  readonly track: Sprite;
  readonly beads: readonly Sprite[];
}

// What a player carries besides the body: the name above, the relève ring, the halo of a revival.
export class PlayerTag {
  private readonly nameEdge: Sprite;
  private readonly name: Sprite;
  private readonly burst: Sprite;
  private ring: Ring | null = null;

  private readonly ctx: RenderContext;
  private readonly rings: Container;

  constructor(ctx: RenderContext, rings: Container, tags: Container) {
    const { textures, layers } = ctx;
    this.ctx = ctx;
    this.rings = rings;
    this.burst = add(layers.glow, textures.halo);
    this.nameEdge = add(tags, textures.halo);
    this.name = add(tags, textures.halo);
  }

  hide(): void {
    this.burst.visible = this.name.visible = this.nameEdge.visible = false;
    if (this.ring !== null) {
      this.ring.container.visible = false;
    }
  }

  // `reach` is how far the body extends, in world units, above its center.
  place(
    player: PlayerState,
    x: number,
    y: number,
    reach: number,
    color: number,
    share: number,
    burst: number,
    frame: Frame,
  ): void {
    this.placeBurst(player, x, y, color, burst, frame);
    this.placeRing(player, x, y, color, share, frame);
    const room = share > 0 ? Math.max(reach, player.radius * RING_SHARE * 1.15) : reach;
    this.placeName(player, x, y, room, color, frame);
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

  private placeRing(
    player: PlayerState,
    x: number,
    y: number,
    color: number,
    share: number,
    frame: Frame,
  ): void {
    if (share <= 0) {
      if (this.ring !== null) {
        this.ring.container.visible = false;
      }
      return;
    }
    const { container, track, beads } = (this.ring ??= this.createRing());
    const { light, palette } = frame;
    container.visible = true;
    container.position.set(x, y);
    container.scale.set((player.radius * RING_SHARE) / this.ctx.textures.ring.radius);
    setTint(track, light.additive ? color : palette.texte);
    track.alpha = light.additive ? 0.3 : 0.55;
    for (let index = 0; index < BEADS; index += 1) {
      const bead = beads[index];
      if (bead !== undefined) {
        setTint(bead, color);
        bead.alpha = Math.min(1, Math.max(0, share * BEADS - index));
      }
    }
  }

  private placeName(
    player: PlayerState,
    x: number,
    y: number,
    reach: number,
    color: number,
    frame: Frame,
  ): void {
    const { name, nameEdge } = this;
    const label = player.name === undefined || player.name === '' ? null : player.name;
    name.visible = nameEdge.visible = label !== null;
    if (label === null) {
      return;
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
  }

  private createRing(): Ring {
    const { textures } = this.ctx;
    const container = this.rings.addChild(new Container());
    const track = add(container, textures.ring);
    const beads: Sprite[] = [];
    for (let index = 0; index < BEADS; index += 1) {
      const angle = (index / BEADS) * TAU - Math.PI / 2;
      const bead = add(container, textures.pip);
      bead.position.set(Math.cos(angle) * RING_TEXTURE_REACH, Math.sin(angle) * RING_TEXTURE_REACH);
      bead.rotation = angle + Math.PI / 2;
      bead.scale.set(1.15, 1.6);
      beads.push(bead);
    }
    return { container, track, beads };
  }
}
