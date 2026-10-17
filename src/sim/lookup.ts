// Apart from `content.ts`, which imports every module by kind: a module that resolves an id
// imports no registry through it.
export function lookup<T>(table: ReadonlyMap<string, T>, id: string, what: string): T {
  const entry = table.get(id);
  if (entry === undefined) {
    throw new Error(`unknown ${what}: "${id}"`);
  }
  return entry;
}
