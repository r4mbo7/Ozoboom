import type { SetDefinition } from '../data/types';
import { t, tn } from '../shared/i18n';
import type { SimState } from '../sim/state';
import { el, icon, setText, setVar } from './dom';
import { formatNumber } from './format';
import { NO_PLUG_HELP, nextPlugHelp, volumeCrans } from './hud-model';
import { PLUG } from './icons';
import { cssName } from './sun';

export interface SpeakerPlugs {
  readonly row: HTMLElement;
  readonly help: HTMLElement;
  build(set: SetDefinition): void;
  update(set: SetDefinition, state: SimState): void;
}

function plugNode(name: string): HTMLElement {
  const plug = el('span', 'ui-plug');
  plug.title = t(name);
  plug.append(icon('ui-plug__icon', PLUG));
  return plug;
}

function paintPlugged(row: HTMLElement, plugged: number, total: number): void {
  row.setAttribute('aria-valuenow', String(plugged));
  const counts = { plugged: formatNumber(plugged), total: formatNumber(total) };
  row.setAttribute(
    'aria-valuetext',
    tn(
      plugged,
      '{plugged} enceinte branchée sur {total}',
      '{plugged} enceintes branchées sur {total}',
      counts,
    ),
  );
}

export function createSpeakerPlugs(): SpeakerPlugs {
  const row = el('div', 'ui-plugs');
  row.setAttribute('role', 'meter');
  row.setAttribute('aria-label', t('Enceintes branchées'));
  row.setAttribute('aria-valuemin', '0');
  const help = el('p', 'ui-hud__help');
  help.setAttribute('role', 'status');
  help.hidden = true;

  let plugs: HTMLElement[] = [];
  let plugHelp = NO_PLUG_HELP;

  return {
    row,
    help,
    build(set) {
      plugs = (set.speakers ?? []).map((speaker) => plugNode(speaker.name));
      row.replaceChildren(...plugs);
      row.setAttribute('aria-valuemax', String(plugs.length));
      row.hidden = plugs.length === 0;
    },
    update(set, state) {
      const levels = volumeCrans(set, state);
      levels.forEach((speaker, index) => {
        const plug = plugs[index];
        if (plug === undefined) {
          return;
        }
        setVar(plug, '--plug', `var(${cssName(speaker.token)})`);
        setVar(plug, '--fill', String(speaker.fill));
        plug.dataset.state = speaker.state;
      });
      paintPlugged(row, state.volume ?? 0, levels.length);
      if (state.events.some((event) => event.type === 'volumeChanged')) {
        row.dataset.bump = row.dataset.bump === 'a' ? 'b' : 'a';
      }

      plugHelp = nextPlugHelp(plugHelp, set, state);
      if (plugHelp.text !== null) {
        setText(help, plugHelp.text);
      }
      help.hidden = plugHelp.text === null;
    },
  };
}
