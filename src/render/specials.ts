import type { Sprite } from 'pixi.js';
import type { EnemyState, SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { BubbleLog, bubbleAlpha } from './bubbles';
import { Particles } from './effects';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, byId, hide, setTint } from './util';
import { ViewPool } from './views';
import { zoneAlpha } from './zones';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const DAY_LIGHT_BOOST = 1.8;
const ZONE_TEXTURE_RADIUS = 120;
const CONE_LENGTH = 160;
const LINK_LENGTH = 64;
const ZEES = 3;
const ZEE_PERIOD = TICKS_PER_BAR * 0.75;
const BUBBLE_HALF_WIDTH = 32;
const BUBBLE_POP_TICKS = TICKS_PER_BEAT / 2;
const BUBBLE_CALM_ALPHA = 0.7;
const REVIVE_SHARDS = 8;

interface SpecialView {
  readonly zone: Sprite;
  readonly veil: Sprite;
  readonly cone: Sprite;
  readonly link: Sprite;
  readonly purse: Sprite;
  readonly zees: readonly Sprite[];
}

interface BubbleView {
  readonly fill: Sprite;
  readonly rim: Sprite;
  readonly text: Sprite;
}

function hideView(view: SpecialView): void {
  hide(view.zone, view.veil, view.cone, view.link, view.purse);
  for (const zee of view.zees) {
    zee.visible = false;
  }
}

function targetOf(state: SimState, enemy: EnemyState): { x: number; y: number } | undefined {
  return enemy.target === 'core' ? state.core : byId(state.players, enemy.target);
}

export function createSpecials(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const t = textures.specials;
  const views = new ViewPool<SpecialView>(
    () => ({
      zone: add(layers.zones, t.zone),
      veil: add(layers.fx, t.zone),
      cone: add(layers.fx, t.cone, 0),
      link: add(layers.fx, t.link, 0),
      purse: add(layers.fx, t.purse),
      zees: Array.from({ length: ZEES }, () => add(layers.fx, t.zee)),
    }),
    hideView,
  );
  const log = new BubbleLog();
  const sparks = new Particles(layers.fx, textures.shard, 32);
  const puffs = new Particles(layers.fx, textures.halo, 4);
  const bubbles: BubbleView[] = Array.from({ length: 3 }, () => ({
    fill: add(layers.bubbles, t.bubble),
    rim: add(layers.bubbles, t.bubbleRim),
    text: add(layers.bubbles, t.blabla),
  }));

  function hideBubble(view: BubbleView): void {
    hide(view.fill, view.rim, view.text);
  }

  function disc(
    sprite: Sprite,
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
  ) {
    sprite.visible = true;
    sprite.position.set(x, y);
    sprite.scale.set(radius / ZONE_TEXTURE_RADIUS);
    setTint(sprite, color);
    sprite.alpha = alpha;
  }

  function drawSleep(view: SpecialView, enemy: EnemyState, x: number, y: number, frame: Frame) {
    for (let index = 0; index < ZEES; index += 1) {
      const zee = view.zees[index];
      if (zee === undefined) {
        continue;
      }
      const phase = (frame.now / ZEE_PERIOD + index / ZEES) % 1;
      const sway = frame.calm ? 0 : Math.sin(phase * TAU) * 3;
      zee.visible = true;
      zee.position.set(x + enemy.radius * 0.7 + sway, y - enemy.radius - phase * 26);
      zee.scale.set((0.45 + phase * 0.45) * (frame.calm ? 0.8 : 1));
      setTint(zee, frame.palette.texte);
      zee.alpha = Math.sin(phase * Math.PI) * (frame.calm ? 0.6 : 0.95);
    }
  }

  function drawCling(
    view: SpecialView,
    enemy: EnemyState,
    x: number,
    y: number,
    state: SimState,
    frame: Frame,
  ) {
    const player =
      enemy.clingingTo === undefined ? undefined : byId(state.players, enemy.clingingTo);
    if (player === undefined) {
      return;
    }
    const dx = player.x - x;
    const dy = player.y - y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const rest = enemy.radius + player.radius + 6;
    const wobble = frame.calm ? 1 : 1 + 0.12 * Math.sin(frame.now * 0.6 + enemy.id);
    const { link } = view;
    link.visible = true;
    link.position.set(x, y);
    link.rotation = Math.atan2(dy, dx);
    link.scale.set(
      distance / LINK_LENGTH,
      Math.min(1.4, Math.max(0.35, (rest / distance) * 1.2)) * wobble,
    );
    setTint(link, frame.palette.texte);
    link.alpha = 0.85;
  }

  function drawDazzle(
    view: SpecialView,
    enemy: EnemyState,
    x: number,
    y: number,
    radius: number,
    state: SimState,
    frame: Frame,
  ) {
    // By day the text color is dark: a camera light stays white, and a little stronger on the pale ground.
    const day = !frame.light.additive;
    const lightColor = day ? WHITE : frame.palette.texte;
    const boost = day ? DAY_LIGHT_BOOST : 1;
    disc(view.veil, x, y, radius, lightColor, zoneAlpha('dazzleVeil', frame.calm) * boost);
    const target = targetOf(state, enemy);
    if (target === undefined) {
      return;
    }
    const length = radius * 1.2;
    const { cone } = view;
    cone.visible = true;
    cone.position.set(x, y);
    cone.rotation = Math.atan2(target.y - y, target.x - x);
    cone.scale.set(length / CONE_LENGTH);
    setTint(cone, lightColor);
    cone.alpha = zoneAlpha('dazzleCone', frame.calm) * boost;
  }

  function drawBubbles(state: SimState, alpha: number, frame: Frame): void {
    const live = log.live(frame.now);
    const { palette, calm, now } = frame;
    for (let index = 0; index < bubbles.length; index += 1) {
      const view = bubbles[index];
      const bubble = live[index];
      if (view === undefined) {
        continue;
      }
      if (bubble === undefined) {
        hideBubble(view);
        continue;
      }
      const enemy = byId(state.enemies, bubble.enemyId);
      if (enemy !== undefined) {
        bubble.x = lerp(enemy.prevX, enemy.x, alpha);
        bubble.y = lerp(enemy.prevY, enemy.y, alpha);
      }
      const age = now - bubble.start;
      const pop = calm ? 1 : 1 - 0.3 * (1 - Math.min(1, age / BUBBLE_POP_TICKS)) ** 2;
      const scale = (BUBBLE_HALF_WIDTH / t.bubble.radius) * pop;
      const visible = bubbleAlpha(age) * (calm ? BUBBLE_CALM_ALPHA : 1);
      const x = bubble.x + 14;
      const y = bubble.y - (enemy?.radius ?? 11) - 22;
      for (const [sprite, color, factor] of [
        [view.fill, palette.solClair, 1],
        [view.rim, palette.texte, 0.55],
        [view.text, palette.texte, 1],
      ] as const) {
        sprite.visible = true;
        sprite.position.set(x, y);
        sprite.scale.set(scale);
        setTint(sprite, color);
        sprite.alpha = visible * factor;
      }
    }
  }

  function reset(): void {
    log.clear();
    sparks.clear();
    puffs.clear();
    for (const view of bubbles) {
      hideBubble(view);
    }
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'enemyBabbled') {
        log.open(event.id, state.tick, event.x, event.y);
      } else if (event.type === 'enemyRevived') {
        const { badVibe, texte } = frame.palette;
        const peak = ctx.options.calmMode ? 0.6 : 0.9;
        for (let index = 0; index < REVIVE_SHARDS; index += 1) {
          const angle = (index / REVIVE_SHARDS) * TAU + event.id;
          sparks.spawn({
            now: state.tick,
            duration: TICKS_PER_BEAT / 2,
            x: event.x,
            y: event.y,
            dx: Math.cos(angle) * 20,
            dy: Math.sin(angle) * 20,
            fromRadius: 3.5,
            toRadius: 2,
            tint: index % 2 === 0 ? badVibe : texte,
            peak,
            spin: angle,
          });
        }
        puffs.spawn({
          now: state.tick,
          duration: TICKS_PER_BEAT / 2,
          x: event.x,
          y: event.y,
          fromRadius: 10,
          toRadius: 30,
          tint: badVibe,
          peak: peak / 2,
        });
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      views.begin();
      for (const enemy of state.enemies) {
        const effect = ctx.specials.get(enemy.kind);
        if (effect === undefined || enemy.hp <= 0) {
          continue;
        }
        const x = lerp(enemy.prevX, enemy.x, alpha);
        const y = lerp(enemy.prevY, enemy.y, alpha);
        const view = views.acquire(enemy.id);
        const { palette, calm } = frame;
        hideView(view);
        if (effect.kind === 'suppress') {
          disc(view.zone, x, y, effect.radius, palette.badVibe, zoneAlpha('suppress', calm));
        } else if (effect.kind === 'yawn') {
          if (enemy.stunTicks > 0) {
            drawSleep(view, enemy, x, y, frame);
          } else {
            disc(view.zone, x, y, effect.radius, palette.badVibe, zoneAlpha('yawn', calm));
          }
        } else if (effect.kind === 'dazzle') {
          drawDazzle(view, enemy, x, y, effect.radius, state, frame);
        } else if (effect.kind === 'cling') {
          drawCling(view, enemy, x, y, state, frame);
        } else if (effect.kind === 'steal' && (enemy.carrying ?? 0) > 0) {
          const { purse } = view;
          purse.visible = true;
          purse.position.set(
            x + enemy.radius * 0.9,
            y - enemy.radius * 1.1 + (calm ? 0 : Math.sin(frame.now * 0.4 + enemy.id) * 1.2),
          );
          purse.scale.set(0.8);
          setTint(purse, palette.or);
        }
      }
      views.end();
      drawBubbles(state, alpha, frame);
      sparks.update(frame.now);
      puffs.update(frame.now);
    },
    reset,
    destroy(): void {
      reset();
      layers.bubbles.destroy({ children: true });
      layers.zones.destroy({ children: true });
    },
  };
}
