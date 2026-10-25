import { isOneOf, isRecord } from './guards';

// Readers of an untrusted JSON value: each returns it typed, or throws on anything else.

export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected an object, got ${String(value)}`);
  }
  return value;
}

export function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected a list, got ${String(value)}`);
  }
  return value.map(read);
}

export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError(`expected a string, got ${String(value)}`);
  }
  return value;
}

export function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`expected a boolean, got ${String(value)}`);
  }
  return value;
}

export function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`expected a number, got ${String(value)}`);
  }
  return value;
}

export function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`expected an integer, got ${String(value)}`);
  }
  return value;
}

export function oneOf<T>(value: unknown, options: readonly T[]): T {
  if (!isOneOf(value, options)) {
    throw new RangeError(`unexpected ${String(value)}`);
  }
  return value;
}
