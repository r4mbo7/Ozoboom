import { SUN_PALETTES } from '../shared/palette';

export interface DefeatFade {
  fall(lost: boolean, durationMs: number): void;
  lift(): void;
}

// An opacity transition on one layer: the compositor runs the fade, the frame loop does nothing.
export function createDefeatFade(root: HTMLElement): DefeatFade {
  const fade = document.createElement('div');
  fade.className = 'defeat-fade';
  fade.style.setProperty('--sol', SUN_PALETTES.nuit.sol);
  fade.style.setProperty('--bad-vibe', SUN_PALETTES.nuit.badVibe);
  root.append(fade);
  return {
    fall(lost, durationMs) {
      fade.style.transitionDuration = `${String(durationMs)}ms`;
      fade.classList.toggle('defeat-fade--on', lost);
    },
    lift() {
      fade.classList.remove('defeat-fade--on');
    },
  };
}
