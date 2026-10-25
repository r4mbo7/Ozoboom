// Apart from `content.ts`, so that a module resolving an id imports no registry through it.
export function lookup<T>(table: ReadonlyMap<string, T>, id: string, what: string): T {
  const entry = table.get(id);
  if (entry === undefined) {
    throw new Error(`unknown ${what}: "${id}"`);
  }
  return entry;
}
