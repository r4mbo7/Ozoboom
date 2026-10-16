import type { DashDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import type { Tempo } from '../shared/tempo';
import { dashGauge } from '../sim/dash';
import type { PlayerState } from '../sim/state';
import { createSkillView } from './bracelet';
import { el, icon, setFlag, setText, setVar } from './dom';
import { DASH } from './icons';

export interface DashTile {
  readonly section: HTMLElement;
  update(
    player: PlayerState,
    dash: DashDefinition | undefined,
    device: InputDevice,
    now: number,
    tempo: Tempo,
  ): void;
}

// The button a touch screen dashes with, next to the skill: elsewhere the arc at the feet is enough.
export function createDashTile(): DashTile {
  const section = el('section', 'ui-hud__skills ui-hud__dash');
  section.setAttribute('aria-label', t('Dash'));
  section.hidden = true;
  const view = createSkillView();
  view.root.dataset.touchControl = 'dash';
  view.glyph.replaceChildren(icon('ui-skill__icon', DASH));
  setText(view.name, t('Dash'));
  const pearls = el('span', 'ui-dash__pearls');
  view.root.append(pearls);
  section.append(view.root);

  return {
    section,
    update(player, dash, device, now, tempo) {
      section.hidden = dash === undefined || device !== 'touch';
      if (dash === undefined || section.hidden) {
        return;
      }
      const gauge = dashGauge(player, dash, now, tempo);
      while (pearls.children.length !== gauge.charges) {
        if (pearls.children.length < gauge.charges) {
          pearls.append(el('span', 'ui-dash__pearl'));
        } else {
          pearls.lastElementChild?.remove();
        }
      }
      [...pearls.children].forEach((pearl, index) => {
        setFlag(pearl as HTMLElement, 'on', index < gauge.ready);
      });
      const ready = gauge.ready > 0;
      setVar(view.root, '--charge', String(ready ? 1 : gauge.fill));
      setFlag(view.root, 'ready', ready);
      setText(view.status, ready ? t('Prêt') : t('Recharge'));
    },
  };
}
