import type { SetDefinition } from '../data/types';
import { t, tn } from '../shared/i18n';
import type { SimState } from '../sim/state';
import { el, icon, setText, setVar } from './dom';
import { formatNumber } from './format';
import { NO_PLUG_HELP, nextPlugHelp, volumeCrans } from './hud-model';
import { SPEAKER } from './icons';
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
  plug.append(icon('ui-plug__icon', SPEAKER, '0 0 22 28'));
  return plug;
}

function paintPlugged(row: HTMLElement, value: HTMLElement, plugged: number, total: number): void {
  row.setAttribute('aria-valuenow', String(plugged));
  const counts = { plugged: formatNumber(plugged), total: formatNumber(total) };
  setText(value, counts.plugged);
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
  const count = el('span', 'ui-plugs__count');
  count.setAttribute('aria-hidden', 'true');
  const value = el('b', 'ui-plugs__value');
  const total = el('span', 'ui-plugs__total');
  const figure = el('span', 'ui-plugs__figure');
  figure.append(value, total);
  count.append(el('span', 'ui-plugs__label', t('Enceintes')), figure);
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
      setText(total, `/${formatNumber(plugs.length)}`);
      row.replaceChildren(count, ...plugs);
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
      paintPlugged(row, value, state.volume ?? 0, levels.length);
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
