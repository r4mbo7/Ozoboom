import { Container } from 'pixi.js';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { shadowAt } from './ground-sun';
import { lerp } from './motion';
import { PlayerTag, ReviveLog } from './player-tags';
import { PLAYER_LOOKS, type PlayerLook, REFERENCE } from './textures-players';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const LOOKS: ReadonlyMap<string, PlayerLook> = new Map(Object.entries(PLAYER_LOOKS));
const TEINTS = [0xf1c9a5, 0xd9a07a, 0xa86f4c, 0x7a4a31];
const DOWNED_TINT = 0x8e8e98;
const CONTOUR_RING = 58;
const CONTOUR_MARGIN = 4;

function turn(now: number, periodTicks: number): number {
  return (((now % periodTicks) + periodTicks) % periodTicks) * (TAU / periodTicks);
}

// The poi make a turn per bar and the parasol one per two bars: they follow the time, not the frame.
export function poiAngle(now: number): number {
  return turn(now, TICKS_PER_BAR);
}

export function parasolAngle(now: number): number {
  return turn(now, 2 * TICKS_PER_BAR);
}

// The contour breathes on the beat, smoothly: never a flash.
export function contourAlpha(now: number): number {
  return 0.3 + 0.35 * (1 + Math.sin(turn(now, TICKS_PER_BEAT)));
}

function teintOf(player: PlayerState): number {
  return TEINTS[player.id % TEINTS.length] ?? 0xf1c9a5;
}

export function createPlayers(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const t = textures.players;
  const ground = layers.players.addChild(new Container());
  const bodies = layers.players.addChild(new Container());
  const rings = layers.players.addChild(new Container());
  const tags = layers.players.addChild(new Container());
  const revives = new ReviveLog();
  const views = new ViewPool(
    () => ({
      halo: add(layers.glow, textures.halo),
      tag: new PlayerTag(ctx, rings, tags),
      shadow: add(ground, t.looks.poi.shadow),
      outline: add(bodies, t.shoulders),
      objectOutline: add(bodies, t.looks.poi.object),
      shoulders: add(bodies, t.shoulders),
      head: add(bodies, t.head),
      object: add(bodies, t.looks.poi.object),
      lying: add(bodies, t.looks.poi.downed),
      aim: add(bodies, t.aim),
      contour: add(bodies, t.contour),
    }),
    (view) => {
      view.tag.hide();
      hide(
        view.halo,
        view.shadow,
        view.outline,
        view.objectOutline,
        view.shoulders,
        view.head,
        view.object,
        view.lying,
        view.aim,
        view.contour,
      );
    },
  );

  return {
    onEvent(event: SimEvent, state: SimState): void {
      revives.onEvent(event, state.tick);
    },
    reset(): void {
      revives.clear();
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse, now } = frame;
      const sun = shadowAt(frame.fraction);
      const sunX = Math.cos(sun.angle);
      const sunY = Math.sin(sun.angle);
      views.begin();
      for (const player of state.players) {
        const view = views.acquire(player.id);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const kind = lookup(LOOKS, player.classId, 'class look');
        const look = t.looks[kind];
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const scale = player.radius / REFERENCE;
        const angle = Math.atan2(player.aim.y, player.aim.x);
        const {
          halo,
          tag,
          shadow,
          outline,
          objectOutline,
          shoulders,
          head,
          object,
          lying,
          aim,
          contour,
        } = view;

        const dazzled = (player.dazzledTicks ?? 0) > 0;
        const share = revives.share(player.id, player.downed, now);
        halo.visible = share > 0 || (!player.downed && !((player.suppressedTicks ?? 0) > 0));
        setTint(halo, dazzled ? palette.texte : color);
        halo.position.set(x, y);
        halo.scale.set(
          ((player.radius * (dazzled ? 4.6 : 3.2)) / textures.halo.radius) * (1 + 0.1 * pulse),
        );
        halo.alpha = dazzled ? Math.min(1, light.haloAlpha * 1.6) : light.haloAlpha;
        if (player.downed) {
          halo.scale.set(((player.radius * 2.6) / textures.halo.radius) * (1 + 0.1 * pulse));
          halo.alpha = light.haloAlpha * 0.8 * share;
        }

        tag.place(
          player,
          x,
          y,
          look.extent * scale * (player.downed ? 1.3 : 1),
          color,
          share,
          revives.burst(player.id, now),
          frame,
        );

        const downed = player.downed;
        const reach = sun.length * (downed ? 1 : look.height * 3);
        shadow.visible = true;
        shadow.texture = look.shadow.texture;
        setTint(shadow, 0x000000);
        shadow.alpha = sun.alpha * (downed ? 0.5 : 1);
        shadow.rotation = sun.angle - Math.PI / 2;
        shadow.position.set(x + sunX * reach, y + sunY * reach);
        shadow.scale.set(scale * (downed ? 0.6 : 1), scale * (0.85 + 0.1 * sun.length));

        lying.visible = downed;
        if (downed) {
          hide(outline, objectOutline, shoulders, head, object, aim, contour);
          lying.texture = look.downed.texture;
          setTint(lying, DOWNED_TINT);
          lying.position.set(x, y);
          lying.rotation = angle;
          lying.scale.set(scale * 1.25);
          lying.alpha = 0.6 + 0.4 * pulse;
          continue;
        }

        const standing = kind === 'poi';
        shoulders.visible = standing;
        head.visible = standing;
        if (standing) {
          shoulders.position.set(x, y);
          shoulders.rotation = angle;
          shoulders.scale.set(scale);
          setTint(shoulders, color);
          head.position.set(x, y);
          head.rotation = angle;
          head.scale.set(scale);
          setTint(head, teintOf(player));
        }
        placeOutline(outline, shoulders, t.shoulders.texture, REFERENCE, frame);

        object.visible = true;
        object.texture = look.object.texture;
        object.position.set(x, y);
        object.scale.set(scale);
        setTint(object, color);
        object.rotation =
          kind === 'poi' ? poiAngle(now) : kind === 'case' ? angle : parasolAngle(now);
        if (standing) {
          objectOutline.visible = false;
        } else {
          placeOutline(objectOutline, object, look.object.texture, REFERENCE, frame);
        }

        aim.visible = true;
        setTint(aim, color);
        const distance = (look.extent + 12) * scale;
        aim.position.set(x + player.aim.x * distance, y + player.aim.y * distance);
        aim.rotation = angle;
        aim.scale.set(scale);

        const invulnerable = (player.invulnerableTicks ?? 0) > 0;
        contour.visible = invulnerable;
        if (invulnerable) {
          setTint(contour, color);
          contour.position.set(x, y);
          contour.scale.set(((look.extent + CONTOUR_MARGIN) / CONTOUR_RING) * scale);
          contour.alpha = contourAlpha(now);
        }
      }
      views.end();
    },
    destroy(): void {
      layers.players.destroy({ children: true });
    },
  };
}
