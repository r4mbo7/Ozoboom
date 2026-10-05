import type { CommandSource } from './types';

export function createLocalSource(): CommandSource {
  return {
    next: (local) => local,
    stepped: () => undefined,
    pending: 0,
    close: () => undefined,
  };
}
