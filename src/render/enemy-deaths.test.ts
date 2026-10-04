import { describe, expect, it } from 'vitest';
import {
  BOSS_SMILE_TICKS,
  CALM_FADE_TICKS,
  type Farewell,
  type FarewellHooks,
  type FarewellSpec,
  Farewells,
  SMILE_TICKS,
} from './enemy-deaths';

interface FakeView {
  shown: boolean;
}

const SPEC: FarewellSpec = {
  id: 1,
  start: 100,
  x: 10,
  y: 20,
  radius: 10,
  tilt: 0,
  boss: false,
  token: 'or',
};

function watch() {
  const log: string[] = [];
  const hooks: FarewellHooks<FakeView> = {
    show: (farewell: Farewell<FakeView>, smile, fade) => {
      farewell.view.shown = true;
      log.push(`show ${smile.toFixed(2)} ${fade.toFixed(2)}`);
    },
    hide: (view) => {
      view.shown = false;
      log.push('hide');
    },
    burst: (farewell) => {
      log.push(`burst ${String(farewell.id)} at ${String(farewell.x)},${String(farewell.y)}`);
    },
  };
  const farewells = new Farewells<FakeView>(4, () => ({ shown: false }));
  return { log, hooks, farewells };
}

describe('Farewells', () => {
  it('smiles for a beat before the burst', () => {
    const { log, hooks, farewells } = watch();
    farewells.start(SPEC);

    farewells.update(SPEC.start, false, hooks);
    farewells.update(SPEC.start + SMILE_TICKS - 1, false, hooks);

    expect(log).toEqual([
      'show 0.00 0.00',
      `show ${((SMILE_TICKS - 1) / SMILE_TICKS).toFixed(2)} 0.00`,
    ]);
  });

  it('bursts once, where the bad vibe died, as the smile ends', () => {
    const { log, hooks, farewells } = watch();
    farewells.start(SPEC);

    farewells.update(SPEC.start + SMILE_TICKS, false, hooks);
    farewells.update(SPEC.start + SMILE_TICKS + 1, false, hooks);

    expect(log).toEqual(['hide', 'burst 1 at 10,20']);
    expect(farewells.liveCount).toBe(0);
  });

  it('smiles longer on a boss', () => {
    const { log, hooks, farewells } = watch();
    farewells.start({ ...SPEC, boss: true });

    farewells.update(SPEC.start + SMILE_TICKS, false, hooks);
    farewells.update(SPEC.start + BOSS_SMILE_TICKS, false, hooks);

    expect(log).toEqual(['show 0.50 0.00', 'hide', 'burst 1 at 10,20']);
  });

  it('fades instead of bursting in calm mode', () => {
    const { log, hooks, farewells } = watch();
    farewells.start(SPEC);

    farewells.update(SPEC.start + SMILE_TICKS, true, hooks);
    farewells.update(SPEC.start + SMILE_TICKS + CALM_FADE_TICKS / 2, true, hooks);
    farewells.update(SPEC.start + SMILE_TICKS + CALM_FADE_TICKS, true, hooks);

    expect(log).toEqual(['show 1.00 0.00', 'show 1.00 0.50', 'hide']);
  });

  it('reuses the oldest slot when more bad vibes die than there is room for', () => {
    const { hooks, farewells } = watch();
    for (let id = 0; id < 6; id += 1) {
      farewells.start({ ...SPEC, id });
    }

    farewells.update(SPEC.start, false, hooks);

    expect(farewells.liveCount).toBe(4);
  });

  it('forgets every farewell on clear', () => {
    const { log, hooks, farewells } = watch();
    farewells.start(SPEC);

    farewells.clear((view) => {
      hooks.hide(view);
    });
    farewells.update(SPEC.start + SMILE_TICKS, false, hooks);

    expect(log).toEqual(['hide', 'hide', 'hide', 'hide']);
    expect(farewells.liveCount).toBe(0);
  });
});
