export type Screen = 'title' | 'class' | 'stage' | 'lobby' | 'game' | 'end' | 'notice';

export interface ShownScreen {
  current(): Screen;
  show(next: Screen): void;
  once(action: () => void): () => void;
}

export function createShownScreen(first: Screen): ShownScreen {
  let screen = first;
  let acted = false;
  return {
    current: () => screen,
    show(next) {
      screen = next;
      acted = false;
    },
    once(action) {
      return () => {
        if (!acted) {
          acted = true;
          action();
        }
      };
    },
  };
}
