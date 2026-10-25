import type { GestureSource } from './gesture';

// A phone plays without the browser's bars; a mouse or a key leaves the window as it is.
export function fullscreenOnFirstTouch(source: GestureSource, enter: () => Promise<void>): void {
  function onLift(event: Event): void {
    if (!('pointerType' in event) || event.pointerType === 'mouse') {
      return;
    }
    source.removeEventListener('pointerup', onLift, true);
    // A browser may refuse the whole screen or the turn, as a desktop one does the turn: the page stays as it is.
    enter().catch((error: unknown) => {
      if (!(error instanceof DOMException || error instanceof TypeError)) {
        throw error;
      }
    });
  }
  source.addEventListener('pointerup', onLift, true);
}

// An iPhone has no whole screen for a page: the game shows full screen once added to the home screen.
export async function enterLandscapeFullscreen(): Promise<void> {
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function' || document.fullscreenElement !== null) {
    return;
  }
  await root.requestFullscreen({ navigationUI: 'hide' });
  await screen.orientation.lock('landscape');
}
