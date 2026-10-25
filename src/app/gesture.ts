const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const;

export interface GestureSource {
  addEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
  removeEventListener(type: string, listener: (event: Event) => void, capture: boolean): void;
}

export interface AudioGate {
  // Called every frame with how to tell whether a pad button is down.
  pad(pressed: () => boolean): void;
}

// Browsers alone decide what opens the audio (not a modifier key, not Escape): every press asks until it runs.
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
  ask();

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
