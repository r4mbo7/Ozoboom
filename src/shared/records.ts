export function keysOf<K extends string>(record: Readonly<Record<K, unknown>>): K[] {
  const keys: K[] = [];
  for (const key in record) {
    keys.push(key);
  }
  return keys;
}

export function recordOf<K extends string, V>(
  keys: readonly K[],
  valueOf: (key: K) => V,
): Record<K, V> {
  const record: Record<string, V> = {};
  for (const key of keys) {
    record[key] = valueOf(key);
  }
  return record;
}
