import type { PlayerCommand } from './commands';
import { createSimulation, type SimulationOptions } from './index';
import type { SimState } from './state';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashState(state: SimState): string {
  const text = canonical(state);
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function runScript(
  options: SimulationOptions,
  script: readonly (readonly PlayerCommand[])[],
): SimState {
  const simulation = createSimulation(options);
  for (const commands of script) {
    simulation.step(commands);
  }
  return simulation.state;
}

function canonical(value: unknown): string {
  switch (typeof value) {
    case 'number':
      return String(value);
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'object':
      if (value === null) {
        return 'null';
      }
      if (Array.isArray(value)) {
        return `[${value.map(canonical).join(',')}]`;
      }
      return `{${Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
        .join(',')}}`;
    default:
      throw new TypeError(`cannot hash a value of type ${typeof value}`);
  }
}
