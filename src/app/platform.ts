import { isRecord } from '../shared/guards';

// The only module of the game that knows the desktop app (ADR 0028): its preload,
// `desktop/src/preload.ts`, puts this bridge on the page, and a browser has none.
export const DESKTOP_BRIDGE = 'ozoboomDesktop';

export interface DesktopBridge {
  quit(): void;
}

export interface Platform {
  readonly quit?: () => void;
}

export function platformOf(page: object): Platform {
  const bridge: unknown = Reflect.get(page, DESKTOP_BRIDGE);
  if (bridge === undefined) {
    return {};
  }
  const quit = isRecord(bridge) ? bridge.quit : undefined;
  if (typeof quit !== 'function') {
    throw new TypeError(`The desktop app's bridge has no quit.`);
  }
  return {
    quit() {
      Reflect.apply(quit, bridge, []);
    },
  };
}
