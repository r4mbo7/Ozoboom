const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const;

export interface GestureSource {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
  removeEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
}

export interface AudioGate {
  // Called every frame with how to tell whether a pad button is down.
  pad(pressed: () => boolean): void;
}

// Browsers keep the audio shut until a gesture, and they alone decide what counts as one: neither a
// modifier key nor Escape does. So every click, key or pad press asks again until the audio runs. A
// finger counts only when it lifts, a pad button only when it goes down.
export function openAudioOnGesture(source: GestureSource, start: () => Promise<void>): AudioGate {
  let open = false;
  let padHeld = false;

  function ask(): void {
    void start().then(() => {
      if (!open) {
        open = true;
        for (const type of GESTURES) {
          source.removeEventListener(type, onGesture, true);
        }
      }
    });
  }
  function onGesture(event: Event): void {
    const touchDown =
      event.type === 'pointerdown' && 'pointerType' in event && event.pointerType !== 'mouse';
    if (!touchDown) {
      ask();
    }
  }
  for (const type of GESTURES) {
    source.addEventListener(type, onGesture, true);
  }

  return {
    pad(pressed) {
      if (open) {
        return;
      }
      const held = pressed();
      if (held && !padHeld) {
        ask();
      }
      padHeld = held;
    },
  };
}
