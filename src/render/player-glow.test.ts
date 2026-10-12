import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { SimState } from '../sim/state';
import { createPlayers } from './players';
import { BODIES, MARKS, createContext, frameAt, player } from './players.test-support';

describe('when a player picks up a vibe', () => {
  function collected(calm: boolean, downed = false) {
    const { ctx, players } = createContext();
    const family = createPlayers(ctx);
    const state = {
      tick: 24,
      players: [player({ downed }), player({ id: 1, x: 300, prevX: 300 })],
    } as unknown as SimState;
    const frame = frameAt(0.4);
    frame.calm = calm;
    frame.now = 24;
    family.update(state, 1, frame);
    const bodies = (players.children[BODIES] as Container).children;
    const rest = bodies.map((sprite) => sprite.scale.x);
    const gold = (layer: Container) =>
      layer.children.filter((sprite) => sprite.visible && sprite.tint === frame.palette.or);

    family.onEvent?.(
      { type: 'pickupCollected', playerId: 0, kind: 'vibes', amount: 1 },
      state,
      frame,
    );
    family.update(state, 1, frame);

    return {
      rims: gold(players.children[MARKS] as Container),
      halos: gold(ctx.layers.fx),
      grown: bodies.filter((sprite, index) => sprite.scale.x > (rest[index] ?? 0) + 1e-9),
    };
  }

  it('lights that player in gold and bounces it, not its teammate', () => {
    const { rims, halos, grown } = collected(false);

    expect(rims).toHaveLength(1);
    expect(halos).toHaveLength(1);
    expect(rims[0]?.x).toBeCloseTo(140, 9);
    expect(halos[0]?.x).toBeCloseTo(140, 9);
    expect(grown.length).toBeGreaterThan(0);
    expect(grown.every((sprite) => sprite.x < 200)).toBe(true);
  });

  it('lights it at half strength and without a bounce in calm mode', () => {
    const lively = collected(false);
    const calm = collected(true);

    expect(calm.halos[0]?.alpha).toBeCloseTo((lively.halos[0]?.alpha ?? 0) / 2, 9);
    expect(calm.rims[0]?.alpha).toBeCloseTo((lively.rims[0]?.alpha ?? 0) / 2, 9);
    expect(calm.grown).toHaveLength(0);
  });

  it('leaves a downed player dark', () => {
    const { rims, halos } = collected(false, true);

    expect(rims).toHaveLength(0);
    expect(halos).toHaveLength(0);
  });
});
