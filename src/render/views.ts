import type { EntityId } from '../sim/state';

interface Entry<V> {
  view: V;
  frame: number;
}

export class ViewPool<V> {
  private readonly active = new Map<EntityId, Entry<V>>();
  private readonly free: V[] = [];
  private readonly create: () => V;
  private readonly release: (view: V) => void;
  private frame = 0;

  constructor(create: () => V, release: (view: V) => void) {
    this.create = create;
    this.release = release;
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }

  begin(): void {
    this.frame += 1;
  }

  acquire(id: EntityId): V {
    const entry = this.active.get(id);
    if (entry !== undefined) {
      entry.frame = this.frame;
      return entry.view;
    }
    const view = this.free.pop() ?? this.create();
    this.active.set(id, { view, frame: this.frame });
    return view;
  }

  end(): void {
    for (const [id, entry] of this.active) {
      if (entry.frame !== this.frame) {
        this.active.delete(id);
        this.release(entry.view);
        this.free.push(entry.view);
      }
    }
  }
}
