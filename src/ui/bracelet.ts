import type { ClassDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import type { PlayerState } from '../sim/state';
import { el, keycap, setFlag, setText, setVar } from './dom';
import { formatNumber, ratio } from './format';
import { playerLabel, skillCharge } from './hud-model';
import { promptsFor } from './prompts';
import { createWho, fillWho, whoColor } from './who';

export interface SkillView {
  root: HTMLElement;
  glyph: HTMLElement;
  name: HTMLElement;
  key: HTMLElement;
  status: HTMLElement;
}

export function createSkillView(): SkillView {
  const root = el('div', 'ui-skill');
  const ring = el('div', 'ui-skill__ring');
  const glyph = el('span', 'ui-skill__glyph');
  ring.append(glyph);
  const name = el('span', 'ui-skill__name');
  const key = el('span', 'ui-skill__key');
  const status = el('span', 'ui-skill__status');
  const text = el('div', 'ui-skill__text');
  text.append(name, status);
  root.append(ring, key, text);
  return { root, glyph, name, key, status };
}

export interface Bracelet {
  readonly element: HTMLElement;
  // The device is that of a player of this screen, whose skill key the bracelet shows; null for the others.
  update(player: PlayerState, definition: ClassDefinition | null, device: InputDevice | null): void;
}

const CRITICAL_RATIO = 0.25;

// A player at a glance, the bracelet of the festival: class, name, life, level and skill.
export function createBracelet(): Bracelet {
  const element = el('section', 'ui-panel ui-bracelet');
  const who = createWho();
  const level = el('span', 'ui-bracelet__level');
  const status = el('span', 'ui-bracelet__status');
  const head = el('div', 'ui-bracelet__head');
  head.append(who, level, status);
  const life = el('div', 'ui-bar ui-bracelet__life');
  life.setAttribute('role', 'meter');
  life.setAttribute('aria-label', 'Vie');
  life.setAttribute('aria-valuemin', '0');
  life.append(el('span', 'ui-bar__fill'));
  const body = el('div', 'ui-bracelet__body');
  body.append(head, life);
  const skill = el('span', 'ui-bracelet__skill');
  const key = el('span', 'ui-bracelet__key');
  element.append(body, skill, key);

  let builtDevice: InputDevice | null = null;

  return {
    element,
    update(player, definition, device) {
      fillWho(who, player);
      setVar(element, '--who', whoColor(player.classId));
      const fraction = ratio(player.hp, player.maxHp);
      setVar(life, '--fill', String(fraction));
      life.setAttribute('aria-valuemax', String(player.maxHp));
      life.setAttribute('aria-valuenow', String(Math.round(player.hp)));
      life.setAttribute(
        'aria-valuetext',
        `${formatNumber(player.hp)} sur ${formatNumber(player.maxHp)}`,
      );
      setFlag(element, 'critical', !player.downed && fraction <= CRITICAL_RATIO);
      setFlag(element, 'downed', player.downed);
      setText(level, `Niv. ${String(player.level)}`);
      setText(status, player.downed ? 'À terre' : '');
      element.setAttribute('aria-label', playerLabel(player));
      if (device !== builtDevice) {
        builtDevice = device;
        const prompts = device === null ? null : promptsFor(device);
        key.replaceChildren(...(prompts === null ? [] : [keycap(prompts.skill, prompts.style)]));
        key.hidden = prompts === null;
      }
      const ready = definition !== null && player.skillCooldown <= 0;
      setVar(
        skill,
        '--charge',
        definition === null ? '0' : String(skillCharge(player, definition.skill)),
      );
      setFlag(skill, 'ready', ready);
      skill.title =
        definition === null ? '' : `${definition.skill.name} : ${ready ? 'prête' : 'en recharge'}`;
    },
  };
}
