import type { GaugeDefinition } from '../data/types';
import { t } from '../shared/i18n';
import type { PlayerState } from '../sim/state';
import { el, setFlag, setText, setVar } from './dom';
import { gaugeNotches, gaugeReading } from './hud-model';

export interface GaugeTile {
  readonly element: HTMLElement;
  build(gauge: GaugeDefinition | undefined): void;
  update(player: PlayerState, gauge: GaugeDefinition): void;
}

export function createGaugeTile(): GaugeTile {
  const element = el('section', 'ui-hud__gauge');
  element.setAttribute('aria-label', t('Jauge'));
  element.hidden = true;
  const ring = el('div', 'ui-gauge__ring');
  ring.setAttribute('role', 'meter');
  ring.setAttribute('aria-valuemin', '0');
  ring.append(el('span', 'ui-gauge__core'));
  const name = el('span', 'ui-gauge__name');
  const status = el('span', 'ui-gauge__status');
  const text = el('div', 'ui-gauge__text');
  text.append(name, status);
  const view = el('div', 'ui-gauge');
  view.append(ring, text);
  element.append(view);

  return {
    element,
    build(gauge) {
      element.hidden = gauge === undefined;
      if (gauge === undefined) {
        return;
      }
      const label = t(gauge.name);
      element.setAttribute('aria-label', label);
      element.title = label;
      ring.setAttribute('aria-label', label);
      ring.setAttribute('aria-valuemax', String(gauge.max));
      setText(name, label);
      const notches = gaugeNotches(gauge);
      setFlag(ring, 'notched', notches > 0);
      setVar(ring, '--notches', String(Math.max(1, notches)));
    },
    update(player, gauge) {
      const reading = gaugeReading(player, gauge);
      setVar(ring, '--gauge-fill', String(reading.fill));
      ring.setAttribute('aria-valuenow', String(player.gauge ?? 0));
      ring.setAttribute('aria-valuetext', reading.text);
      setText(status, reading.text);
      setFlag(element, 'full', reading.full);
    },
  };
}
