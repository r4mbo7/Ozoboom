import type { Container, Sprite } from 'pixi.js';
import { clamp01 } from '../shared/scalar';
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
const DOWNED_NAME = { size: 1.15, face: 0.92 };

interface Revive {
  progress: number;
  tick: number;
  revivedTick: number;
}

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

  share(id: PlayerId, downed: boolean, now: number): number {
    const revive = this.items.get(id);
    if (revive === undefined || !downed || now - revive.tick > REVIVE_GRACE) {
      return 0;
    }
    return clamp01(revive.progress);
  }

  burst(id: PlayerId, now: number): number {
    const revive = this.items.get(id);
    return revive === undefined ? 1 : clamp01((now - revive.revivedTick) / REVIVED_TICKS);
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

export class PlayerTag {
  private readonly face: Sprite;
  private readonly rim: Sprite;
  private readonly nameEdge: Sprite;
  private readonly name: Sprite;
  private readonly burst: Sprite;

  private readonly ctx: RenderContext;

  constructor(ctx: RenderContext, tags: Container) {
    const { textures, layers } = ctx;
    this.ctx = ctx;
    this.burst = add(layers.glow, textures.halo);
    this.face = add(tags, textures.halo);
    this.rim = add(tags, textures.halo);
    this.nameEdge = add(tags, textures.halo);
    this.name = add(tags, textures.halo);
  }

  hide(): void {
    this.burst.visible = this.name.visible = this.nameEdge.visible = false;
    this.face.visible = this.rim.visible = false;
  }

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
    const { name, nameEdge, face, rim } = this;
    const label =
      player.name !== undefined && player.name !== ''
        ? player.name
        : team
          ? defaultName(player.id)
          : null;
    name.visible = nameEdge.visible = label !== null;
    face.visible = rim.visible = label !== null && player.downed;
    if (label === null) {
      return y - reach;
    }
    const { light, palette, camera } = frame;
    const dark = light.additive ? palette.sol : palette.texte;
    const texts = this.ctx.textures.names.get(label);
    if (name.texture !== texts.fill) {
      name.texture = texts.fill;
      nameEdge.texture = texts.edge;
    }
    const grow = player.downed ? DOWNED_NAME.size : 1;
    const size = grow / (NAME_TEXTURE_SCALE * camera.scale);
    let height = texts.fill.height;
    if (player.downed) {
      const plate = this.ctx.textures.names.plate(label);
      face.texture = plate.face;
      rim.texture = plate.rim;
      height = plate.face.height;
      setTint(face, dark);
      setTint(rim, color);
      face.alpha = DOWNED_NAME.face;
    }
    const half = (height / NAME_TEXTURE_SCALE / 2) * grow;
    const above = reach + (half + NAME_GAP) / camera.scale;
    for (const sprite of [name, nameEdge, face, rim]) {
      sprite.position.set(x, y - above);
      sprite.scale.set(size);
    }
    setTint(name, player.downed ? (light.additive ? palette.texte : palette.sol) : color);
    setTint(nameEdge, dark);
    nameEdge.alpha = light.additive ? 0.7 : 0.9;
    return y - above - half / camera.scale;
  }
}
