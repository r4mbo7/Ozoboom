export interface LeaveGuard {
  arm(): void;
  disarm(): void;
}

// A bookmark clicked by mistake would lose the room: the browser asks first, in its own words.
// Armed only in a room, since Firefox keeps no page with this listener in its back-forward cache.
export function createLeaveGuard(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
): LeaveGuard {
  const ask = (event: Event): void => {
    event.preventDefault();
  };
  return {
    arm() {
      target.addEventListener('beforeunload', ask);
    },
    disarm() {
      target.removeEventListener('beforeunload', ask);
    },
  };
}
