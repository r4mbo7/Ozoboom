import type { EntityId } from '../sim/state';

interface Entry<V> {
  id: EntityId;
  frame: number;
  readonly view: V;
}

export class ViewPool<V> {
  private readonly active = new Map<EntityId, Entry<V>>();
  private readonly free: Entry<V>[] = [];
  private readonly create: () => V;
  private readonly release: (view: V) => void;
  private frame = 0;

  // Bound once: iterating with a stored callback allocates neither an iterator nor [key, value] pairs.
  private readonly releaseStale = (entry: Entry<V>): void => {
    if (entry.frame !== this.frame) {
      this.active.delete(entry.id);
      this.release(entry.view);
      this.free.push(entry);
    }
  };

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
    let entry = this.active.get(id);
    if (entry === undefined) {
      entry = this.free.pop() ?? { id, frame: 0, view: this.create() };
      entry.id = id;
      this.active.set(id, entry);
    }
    entry.frame = this.frame;
    return entry.view;
  }

  peek(id: EntityId): V | undefined {
    return this.active.get(id)?.view;
  }

  end(): void {
    this.active.forEach(this.releaseStale);
  }

  releaseAll(): void {
    this.begin();
    this.end();
  }
}
