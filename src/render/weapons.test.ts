import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import type { EntityId, ProjectileState, SimState } from '../sim/state';
import type { RenderContext } from './context';
import { FIXTURE_CONTENT, createFixtureState } from './fixture';
import { advanceFixture } from './fixture-step';
import { giveWeapons } from './fixture-weapons';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import { createProjectiles } from './projectiles';
import type { Shape } from './textures';
import { WEAPON_KINDS } from './textures-weapons';
import { arcLook, arcProgress } from './weapon-looks';
import { createWeapons } from './weapons';

function frameAt(fraction: number): Frame {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

function context(): RenderContext {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  return {
    textures: {
      halo: shape,
      ring: shape,
      pip: shape,
      enemyShot: shape,
      streak: shape,
      weapons: {
        icons: Object.fromEntries(WEAPON_KINDS.map((kind) => [kind, shape])),
        sparkShot: shape,
        swing: shape,
        swingFull: shape,
        hoopRing: shape,
        dash: shape,
        zone: shape,
        shadow: shape,
      },
    },
    layers: createLayers(new Container()),
    options: { calmMode: false },
    classTokens: new Map([
      ['mage', 'mage'],
      ['tank', 'tank'],
      ['healer', 'healer'],
    ]),
    behaviours: new Map(),
    trapLooks: new Map(),
    weaponLooks: new Map((FIXTURE_CONTENT.weapons ?? []).map((def) => [def.id, def])),
  } as unknown as RenderContext;
}

function diabolo(state: SimState, id: EntityId, ticksLeft: number): ProjectileState {
  const projectile: ProjectileState = {
    id,
    owner: { kind: 'weapon', playerId: 0, weaponId: 'diabolo' },
    vx: 0,
    vy: 0,
    radius: 6,
    damage: 1,
    ticksLeft,
    pierceLeft: 0,
    x: 600,
    y: 500,
    prevX: 600,
    prevY: 500,
    arc: { toX: 700, toY: 500, ticksTotal: 24 },
  };
  state.projectiles = [projectile];
  return projectile;
}

describe('the diabolo shadow', () => {
  it.each([
    [24, 0],
    [12, 0.5],
    [0, 1],
  ])('reads %i ticks left as %f of the arc', (ticksLeft, progress) => {
    expect(arcProgress(ticksLeft, 24, 0)).toBeCloseTo(progress);
  });

  it('is full size and dark at both ends of the arc and smallest and faintest at the top', () => {
    const [launch, apex, landing] = [0, 0.5, 1].map((progress) => arcLook(progress));

    expect(launch?.shadowScale).toBeCloseTo(1);
    expect(landing?.shadowScale).toBeCloseTo(1);
    expect(apex?.shadowScale).toBeLessThan(0.5 + 0.2);
    expect(apex?.shadowAlpha).toBeLessThan(launch?.shadowAlpha ?? 0);
    expect(apex?.lift).toBeGreaterThan(launch?.lift ?? 1);
  });

  it('follows the arc of the projectile from one image to the next', () => {
    const ctx = context();
    const family = createWeapons(ctx);
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    giveWeapons(state, ['diabolo']);
    const shadows = [24, 18, 12, 6, 0].map((ticksLeft) => {
      diabolo(state, 900, ticksLeft);
      family.update(state, 0, frameAt(0.4));
      return family.shadowOf(900);
    });

    const scales = shadows.map((shadow) => shadow?.scale ?? 0);
    expect(shadows.every((shadow) => shadow?.visible === true)).toBe(true);
    expect(scales[2]).toBeLessThan(scales[1] ?? 0);
    expect(scales[1]).toBeLessThan(scales[0] ?? 0);
    expect(scales[3]).toBeGreaterThan(scales[2] ?? 1);
    expect(scales[4]).toBeCloseTo(scales[0] ?? 0);
    expect(shadows[2]?.alpha).toBeLessThan(shadows[0]?.alpha ?? 0);
  });
});

describe('ribbon marks', () => {
  it('draw one ring on each bad vibe that is marked and none on the others', () => {
    const family = createWeapons(context());
    const state = createFixtureState({ enemies: 12, projectiles: 0 });
    const marked = state.enemies.slice(0, 5);
    for (const enemy of marked) {
      enemy.marked = true;
    }

    family.update(state, 0, frameAt(0.4));
    const first = family.marks;
    const [lifted] = state.enemies;
    if (lifted === undefined) {
      throw new Error('Fixture has no bad vibe');
    }
    lifted.marked = false;
    family.update(state, 0, frameAt(0.4));

    expect(first).toBe(5);
    expect(family.marks).toBe(4);
  });

  it('draw nothing when no bad vibe is marked', () => {
    const family = createWeapons(context());

    family.update(createFixtureState({ enemies: 12, projectiles: 0 }), 0, frameAt(1));

    expect(family.marks).toBe(0);
  });

  it('rise with the long curve of the ribbon when it fires', () => {
    const family = createWeapons(context());
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    giveWeapons(state, ['ruban-arc-en-ciel']);
    const frame = frameAt(0.4);

    family.onEvent?.(
      { type: 'weaponFired', playerId: 0, weaponId: 'ruban-arc-en-ciel', x: 1, y: 2 },
      state,
      frame,
    );

    expect(family.ribbons).toBe(1);
  });
});

describe('weapons on the grid', () => {
  it('draws what the sixteenth-note grid fires, for the ten weapons, without a failure', () => {
    const ctx = context();
    const family = createWeapons(ctx);
    const state = createFixtureState({ enemies: 30, projectiles: 0 });
    giveWeapons(
      state,
      (FIXTURE_CONTENT.weapons ?? []).slice(0, 10).map((weapon) => weapon.id),
    );

    for (let tick = 0; tick < 200; tick += 1) {
      advanceFixture(state, []);
      for (const event of state.events) {
        family.onEvent?.(event, state, frameAt(0.4));
      }
      family.update(state, 0.5, frameAt(0.4));
    }

    expect(ctx.layers.weapons.children.filter((child) => child.visible).length).toBeGreaterThan(20);
    expect(family.transients + family.ribbons).toBeGreaterThan(0);
  });

  it('keeps what the weapons draw out of the generic shots of the projectiles family', () => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    diabolo(state, 900, 12);

    createProjectiles(ctx).update(state, 0, frameAt(0.4));

    expect(ctx.layers.fx.children.filter((child) => child.visible)).toHaveLength(0);
    expect(ctx.layers.enemyShots.children.filter((child) => child.visible)).toHaveLength(0);
  });
});

describe('light rule of the weapons', () => {
  it.each([
    [0.4, false],
    [1, true],
  ])('wears a dark outline by day only, at %f', (fraction, outlined) => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    giveWeapons(state, ['totem']);
    const frame = frameAt(fraction);

    createWeapons(ctx).update(state, 0, frame);

    const [outline, body] = ctx.layers.weapons.children;
    expect(outline?.visible).toBe(outlined);
    expect(body?.tint).toBe(frame.palette.tank);
  });

  it('tints a weapon without a class in gold', () => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    giveWeapons(state, ['ruban-arc-en-ciel']);
    const frame = frameAt(0.4);

    createWeapons(ctx).update(state, 0, frame);

    expect(ctx.layers.weapons.children[1]?.tint).toBe(frame.palette.or);
  });

  it.each([
    ['baton-de-feu', 1],
    ['double-baton', 2],
    ['cerceaux', 1],
    ['anneaux-solaires', 3],
  ])('shows %s as %i held silhouettes', (id, copies) => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    giveWeapons(state, [id]);

    createWeapons(ctx).update(state, 0, frameAt(0.4));

    expect(
      ctx.layers.weapons.children.filter((child, index) => child.visible && index % 2 === 1),
    ).toHaveLength(copies);
  });
});
