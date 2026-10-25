import { t, tn } from '../shared/i18n';
import type { PlayerState } from '../sim/state';
import { el, setFlag, setText, setVar } from './dom';
import { formatNumber } from './format';
import { levelReading } from './hud-model';

export interface LevelRing {
  readonly element: HTMLElement;
  update(player: PlayerState): void;
  reset(): void;
}

function levelTitle(player: PlayerState): string {
  return tn(
    player.vibesToNextLevel,
    'Niveau {level} : {vibes} vibes sur {next}',
    'Niveau {level} : {vibes} vibes sur {next}',
    {
      level: formatNumber(player.level),
      vibes: formatNumber(player.vibes),
      next: formatNumber(player.vibesToNextLevel),
    },
  );
}

export function createLevelRing(): LevelRing {
  const element = el('section', 'ui-hud__level');
  element.setAttribute('aria-label', t('Niveau'));
  const ring = el('div', 'ui-level');
  const number = el('span', 'ui-level__number');
  ring.append(number);
  element.append(ring);
  let shown: Pick<PlayerState, 'level' | 'vibes'> | null = null;

  return {
    element,
    update(player) {
      const reading = levelReading(shown, player);
      if (shown === null || reading.levelled) {
        ring.dataset.restart = '';
        setVar(ring, '--level-fill', '0');
        // Reading the style commits the empty ring: the fill then glides up from it, not back to it.
        void getComputedStyle(ring).getPropertyValue('--level-fill');
        delete ring.dataset.restart;
      }
      shown = { level: player.level, vibes: player.vibes };
      setText(number, String(player.level));
      setVar(ring, '--level-fill', String(reading.fill));
      setFlag(element, 'near', reading.near);
      if (reading.gained) {
        ring.dataset.gain = ring.dataset.gain === 'a' ? 'b' : 'a';
      }
      if (reading.levelled) {
        ring.dataset.burst = ring.dataset.burst === 'a' ? 'b' : 'a';
      }
      element.title = levelTitle(player);
    },
    reset() {
      shown = null;
      delete ring.dataset.gain;
      delete ring.dataset.burst;
    },
  };
}
