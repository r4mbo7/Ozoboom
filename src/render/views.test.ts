import { describe, expect, it } from 'vitest';
import { ViewPool } from './views';

interface FakeView {
  serial: number;
  visible: boolean;
}

function createPool() {
  let created = 0;
  const pool = new ViewPool<FakeView>(
    () => ({ serial: (created += 1), visible: true }),
    (view) => {
      view.visible = false;
    },
  );
  return { pool, createdCount: () => created };
}

function frame(pool: ViewPool<FakeView>, ids: readonly number[]): FakeView[] {
  pool.begin();
  const views = ids.map((id) => {
    const view = pool.acquire(id);
    view.visible = true;
    return view;
  });
  pool.end();
  return views;
}

describe('ViewPool', () => {
  it('keeps the same view for an entity across frames', () => {
    const { pool } = createPool();

    const [first] = frame(pool, [7]);
    const [second] = frame(pool, [7]);

    expect(second).toBe(first);
  });

  it('releases the views of entities that disappeared', () => {
    const { pool } = createPool();
    const [, gone] = frame(pool, [1, 2, 3]);

    frame(pool, [1, 3]);

    expect(gone?.visible).toBe(false);
    expect(pool.activeCount).toBe(2);
    expect(pool.freeCount).toBe(1);
  });

  it('reuses released views instead of creating new ones', () => {
    const { pool, createdCount } = createPool();
    frame(pool, [1, 2, 3]);
    frame(pool, []);

    frame(pool, [4, 5, 6]);

    expect(createdCount()).toBe(3);
    expect(pool.activeCount).toBe(3);
    expect(pool.freeCount).toBe(0);
  });

  it('stays bounded when every entity is replaced at each frame', () => {
    const { pool, createdCount } = createPool();

    for (let wave = 0; wave < 100; wave += 1) {
      frame(pool, [wave * 3, wave * 3 + 1, wave * 3 + 2]);
    }

    expect(createdCount()).toBe(6);
    expect(pool.activeCount + pool.freeCount).toBe(6);
  });
});
