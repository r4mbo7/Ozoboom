import { Container, type Sprite } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import { type Cables, type Shine, createCables } from './batterie-cables';
import { type MaskAt, onMask, paintLooks, pointOnMask } from './batterie-looks';
import {
  GAUGE,
  PLUG_BEATS,
  REACH,
  SOCKETS,
  cellGlow,
  cellsLit,
  teamCell,
} from './batterie-moments';
import { BURST_AT, FROZEN_BEATS, bossCrackStage, farewellPose } from './boss-moments';
import type { Family, RenderContext } from './context';
import type { EnemyPose } from './enemies';
import { BOSS_SCALE, FACE_RADIUS } from './face-kit';
import type { Frame } from './frame';
import { lerp } from './motion';
import { TRAP_TOKENS } from './textures';
import { add, hide, lookup, setTint } from './util';
import { ViewPool } from './views';
import { mixColor } from './weapon-kit';

const KIND = 'batterie-a-plat';
// The cold light of a charged cell.
const CELL = { tint: 0xc9d2f5, alpha: 0.85 };
// How much of a halo she takes while plugged into it.
const DRAIN = 0.6;
const BULGE_BEATS = 1;
// Where a cable plugs into a player or a trap: at its feet, in radii.
const PLUG_AT = { player: 0.8, trap: 0.6 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Boss {
  readonly cells: Sprite[];
  readonly flanks: Sprite;
  readonly cables: Cables;
  // Beats spent plugged into something: they charge her gauge.
  charge: number;
  lastNow: number;
  bulgeSince: number;
}

interface Exit {
  readonly id: EntityId;
  readonly start: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tilt: number;
  readonly scale: number;
  readonly lit: number;
  readonly team: readonly PaletteToken[];
}

function raise<K>(map: Map<K, number>, key: K, value: number): void {
  map.set(key, Math.max(map.get(key) ?? 0, value));
}

// The Batterie à plat, beyond her mask: the cells of her gauge, her flanks swelling as she heats up,
// and the three cables she plugs into what shines, whose pearls she drains while their halos go
// down. Chased, she gives the pearls back and her gauge fades through the team's colors before it
// bursts with her. Render only.
export function createBatterieAPlat(
  ctx: RenderContext,
  poseOf: (id: EntityId) => EnemyPose | undefined,
): Family {
  const { layers } = ctx;
  const looks = paintLooks();
  const cableLines = layers.dim.addChild(new Container());
  const liveCells = layers.enemies.addChild(new Container());
  const exitCells = layers.farewells.addChild(new Container());
  const pearls = layers.fx.addChild(new Container());
  const exits: Exit[] = [];

  const bosses = new ViewPool<Boss>(
    () => ({
      cells: Array.from({ length: GAUGE.cells }, () => add(liveCells, looks.cell)),
      flanks: add(liveCells, looks.flanks),
      cables: createCables(cableLines, pearls, looks.pearl, looks.calmPearl),
      charge: 0,
      lastNow: Number.NaN,
      bulgeSince: Number.NaN,
    }),
    (boss) => {
      hide(boss.flanks, ...boss.cells);
      boss.cables.hide();
      boss.charge = 0;
      boss.lastNow = boss.bulgeSince = Number.NaN;
    },
  );

  function shinesOf(state: SimState, alpha: number): Shine[] {
    const shines: Shine[] = [];
    for (const player of state.players) {
      if (!player.downed) {
        shines.push({
          kind: 'player',
          id: player.id,
          key: `p${String(player.id)}`,
          x: lerp(player.prevX, player.x, alpha),
          y: lerp(player.prevY, player.y, alpha) + player.radius * PLUG_AT.player,
          token: lookup(ctx.classTokens, player.classId, 'class'),
        });
      }
    }
    for (const trap of state.traps) {
      const look = lookup(ctx.trapLooks, trap.kind, 'trap');
      shines.push({
        kind: 'trap',
        id: trap.id,
        key: `t${String(trap.id)}`,
        x: lerp(trap.prevX, trap.x, alpha),
        y: lerp(trap.prevY, trap.y, alpha) + look.radius * PLUG_AT.trap,
        token: TRAP_TOKENS[look.effect.kind],
      });
    }
    return shines;
  }

  function placeCell(cell: Sprite, parent: Container, at: MaskAt, index: number): void {
    if (cell.parent !== parent) {
      parent.addChild(cell);
    }
    onMask(cell, at, GAUGE.firstX + index * GAUGE.step, GAUGE.y);
  }

  function live(boss: Boss, pose: EnemyPose, hot: boolean, shines: Shine[], frame: Frame): void {
    const { sprite } = pose;
    const { position, scale } = sprite;
    const at: MaskAt = {
      x: position.x,
      y: position.y,
      rotation: sprite.rotation,
      scaleX: scale.x,
      scaleY: scale.y,
    };
    const beats = frame.now / frame.tempo.ticksPerBeat;
    const lit = cellsLit(boss.charge);
    boss.cells.forEach((cell, index) => {
      placeCell(cell, liveCells, at, index);
      setTint(cell, CELL.tint);
      cell.alpha = cellGlow(index, lit, beats, frame.calm) * CELL.alpha * sprite.alpha;
    });
    if (hot && Number.isNaN(boss.bulgeSince)) {
      boss.bulgeSince = beats;
    }
    boss.flanks.visible = hot;
    if (hot) {
      onMask(boss.flanks, at, 0, 0);
      setTint(boss.flanks, sprite.tint);
      boss.flanks.alpha = sprite.alpha * clamp01((beats - boss.bulgeSince) / BULGE_BEATS);
    }
    const run = {
      boss: [pose.x, pose.y] as const,
      sockets: SOCKETS.map((socket) => pointOnMask(at, socket)),
      reach: REACH * pose.radius,
      unit: pose.radius / FACE_RADIUS,
      beats,
      mode: 'drain' as const,
    };
    let full = 0;
    for (const { shine, reach } of boss.cables.update(run, shines, frame)) {
      if (shine.kind === 'player') {
        raise(frame.drained.players, shine.id, reach * DRAIN);
      } else {
        raise(frame.drained.traps, shine.id, reach * DRAIN);
      }
      full += reach >= 1 ? 1 : 0;
    }
    if (full > 0 && !Number.isNaN(boss.lastNow)) {
      boss.charge += Math.max(0, frame.now - boss.lastNow) / frame.tempo.ticksPerBeat;
    }
    boss.lastNow = frame.now;
  }

  function leave(exit: Exit, shines: Shine[], frame: Frame): boolean {
    const beats = (frame.show - exit.start) / frame.tempo.ticksPerBeat;
    if (beats >= BURST_AT + PLUG_BEATS) {
      return false;
    }
    const boss = bosses.acquire(exit.id);
    const { x, y, radius, tilt, scale, lit, team } = exit;
    const { palette, calm } = frame;
    const pose = farewellPose(beats, calm);
    const at: MaskAt = {
      x: x + pose.tremble * radius,
      y: y - pose.lift * radius,
      rotation: tilt,
      scaleX: scale * pose.scale,
      scaleY: scale * pose.scale,
    };
    boss.flanks.visible = pose.phase === 'frozen';
    if (pose.phase === 'frozen') {
      onMask(boss.flanks, at, 0, 0);
      setTint(boss.flanks, palette.badVibeRim);
      boss.flanks.alpha = 1;
    }
    boss.cells.forEach((cell, index) => {
      if (pose.phase === 'gone') {
        cell.visible = false;
        return;
      }
      placeCell(cell, exitCells, at, index);
      if (pose.phase === 'frozen') {
        setTint(cell, CELL.tint);
        cell.alpha = cellGlow(index, lit, beats, calm) * CELL.alpha;
        return;
      }
      const fade = teamCell(index, beats - FROZEN_BEATS, team.length, calm);
      setTint(
        cell,
        mixColor(palette[team[fade.from] ?? 'or'], palette[team[fade.to] ?? 'or'], fade.mix),
      );
      cell.alpha = 1;
    });
    const run = {
      boss: [x, y] as const,
      sockets: SOCKETS.map((socket) => pointOnMask(at, socket)),
      reach: REACH * radius,
      unit: radius / FACE_RADIUS,
      beats: frame.show / frame.tempo.ticksPerBeat,
      mode: pose.phase === 'gone' ? ('off' as const) : ('give' as const),
    };
    boss.cables.update(run, shines, frame);
    return true;
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      frame.drained.players.clear();
      frame.drained.traps.clear();
      bosses.begin();
      let shines: Shine[] | null = null;
      const shining = () => (shines ??= shinesOf(state, alpha));
      for (const enemy of state.enemies) {
        const pose = enemy.kind === KIND ? poseOf(enemy.id) : undefined;
        if (pose !== undefined) {
          const hot = bossCrackStage(enemy.hp, enemy.maxHp) === 2;
          live(bosses.acquire(enemy.id), pose, hot, shining(), frame);
        }
      }
      for (let index = exits.length - 1; index >= 0; index -= 1) {
        const exit = exits[index];
        if (exit !== undefined && !leave(exit, shining(), frame)) {
          exits.splice(index, 1);
        }
      }
      bosses.end();
    },
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type !== 'enemyDied' || event.kind !== KIND) {
        return;
      }
      const pose = poseOf(event.id);
      const radius = pose?.radius ?? ctx.enemyRadii?.get(KIND) ?? FACE_RADIUS;
      const team = state.players.map((player) => lookup(ctx.classTokens, player.classId, 'class'));
      layers.farewells.addChild(exitCells);
      exits.push({
        id: event.id,
        start: frame.show,
        x: event.x,
        y: event.y,
        radius,
        tilt: pose?.tilt ?? 0,
        scale: radius / (FACE_RADIUS * BOSS_SCALE),
        lit: cellsLit(bosses.peek(event.id)?.charge ?? 0),
        team: team.length > 0 ? team : ['or'],
      });
    },
    reset(): void {
      bosses.releaseAll();
      exits.length = 0;
    },
    destroy(): void {
      for (const container of [cableLines, liveCells, exitCells, pearls]) {
        container.destroy({ children: true });
      }
      for (const look of [looks.cell, looks.flanks, looks.pearl, looks.calmPearl]) {
        look.texture.destroy(true);
      }
    },
  };
}
