const MENU_GRACE_MS = 500;

export interface MenuGrace {
  start(): void;
  over(): boolean;
}

export function createMenuGrace(now: () => number): MenuGrace {
  let opensAt = 0;
  return {
    start() {
      opensAt = now() + MENU_GRACE_MS;
    },
    over: () => now() >= opensAt,
  };
}
