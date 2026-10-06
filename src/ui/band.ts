import type { ClassDefinition, GameContent } from '../data/types';
import type { InputDevice } from '../input/intents';
import type { PlayerState } from '../sim/state';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { formatNumber, ratio } from './format';
import { gearSlots, skillCharge } from './hud-model';
import { skillIcon, weaponIcon } from './icons';
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

export interface Band {
  readonly element: HTMLElement;
  update(
    player: PlayerState,
    definition: ClassDefinition | null,
    device: InputDevice,
    content: GameContent,
  ): void;
}

const CRITICAL_RATIO = 0.25;

function healthBar(label: string): { bar: HTMLElement; fill: HTMLElement } {
  const bar = el('div', 'ui-bar ui-band__bar');
  bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-label', label);
  bar.setAttribute('aria-valuemin', '0');
  const fill = el('span', 'ui-bar__fill');
  bar.append(fill);
  return { bar, fill };
}

function updateHealth(
  band: HTMLElement,
  bar: HTMLElement,
  value: HTMLElement,
  player: PlayerState,
): void {
  const fraction = ratio(player.hp, player.maxHp);
  setVar(bar, '--fill', String(fraction));
  bar.setAttribute('aria-valuemax', String(player.maxHp));
  bar.setAttribute('aria-valuenow', String(Math.round(player.hp)));
  setText(value, `${formatNumber(player.hp)} / ${formatNumber(player.maxHp)}`);
  setFlag(band, 'critical', !player.downed && fraction <= CRITICAL_RATIO);
  setFlag(band, 'downed', player.downed);
}

// The whole of a player of this screen: life, level, vibes and skill.
export function createFullBand(): Band {
  const element = el('section', 'ui-panel ui-band');
  const who = createWho();
  const className = el('span', 'ui-band__class');
  const status = el('span', 'ui-band__status');
  const head = el('div', 'ui-band__head');
  head.append(who, className, status);

  const hpValue = el('span', 'ui-band__value');
  const hp = healthBar('Vie');
  const hpRow = el('div', 'ui-band__row');
  hpRow.append(el('span', 'ui-band__label', 'Vie'), hp.bar, hpValue);

  const levelValue = el('span', 'ui-band__value');
  const vibes = el('div', 'ui-bar ui-band__bar');
  vibes.append(el('span', 'ui-bar__fill'));
  const levelLabel = el('span', 'ui-band__label');
  const levelRow = el('div', 'ui-band__row ui-band__row--vibes');
  levelRow.append(levelLabel, vibes, levelValue);

  const gear = el('div', 'ui-band__gear');
  let gearKey = '';
  const main = el('div', 'ui-band__main');
  main.append(head, hpRow, levelRow, gear);
  const skill = createSkillView();
  const skills = el('div', 'ui-band__skills');
  skills.append(skill.root);
  element.append(main, skills);

  let builtFor: ClassDefinition | null = null;
  let builtDevice: InputDevice | null = null;

  function build(definition: ClassDefinition, device: InputDevice): void {
    builtFor = definition;
    builtDevice = device;
    const prompts = promptsFor(device);
    skill.glyph.replaceChildren(icon('ui-skill__icon', skillIcon(definition.skill.effect)));
    setText(skill.name, definition.skill.name);
    skill.key.replaceChildren(keycap(prompts.skill, prompts.style));
    setText(className, definition.name);
  }

  return {
    element,
    update(player, definition, device, content) {
      fillWho(who, player);
      setVar(element, '--who', whoColor(player.classId));
      const held = gearSlots(player, content).filter((slot) => slot.weapon !== null);
      const key = held.map((slot) => `${slot.weapon?.id ?? ''}:${String(slot.level)}`).join(',');
      if (key !== gearKey) {
        gearKey = key;
        gear.replaceChildren(
          ...held.flatMap((slot) => {
            if (slot.weapon === null) {
              return [];
            }
            const chip = el('span', 'ui-band__weapon');
            chip.title = `${slot.weapon.name}, niveau ${String(slot.level)}`;
            chip.setAttribute('role', 'img');
            chip.setAttribute('aria-label', chip.title);
            chip.append(
              icon('ui-band__weapon-icon', weaponIcon(slot.weapon.effect)),
              el('span', 'ui-band__weapon-level', String(slot.level)),
            );
            return [chip];
          }),
        );
      }
      element.setAttribute('aria-label', `${who.textContent}, ${className.textContent}`);
      if (definition !== null && (definition !== builtFor || device !== builtDevice)) {
        build(definition, device);
      }
      updateHealth(element, hp.bar, hpValue, player);
      setText(status, player.downed ? 'À terre' : '');
      setText(levelLabel, `Niv. ${String(player.level)}`);
      setVar(vibes, '--fill', String(ratio(player.vibes, player.vibesToNextLevel)));
      setText(
        levelValue,
        `${formatNumber(player.vibes)} / ${formatNumber(player.vibesToNextLevel)}`,
      );
      if (definition !== null) {
        const skillReady = player.skillCooldown <= 0;
        setVar(skill.root, '--charge', String(skillCharge(player, definition.skill)));
        setFlag(skill.root, 'ready', skillReady);
        setText(skill.status, skillReady ? 'Prête' : 'Recharge');
      }
    },
  };
}

// A player of another screen: who they are, and whether they still stand.
export function createCompactBand(): Band {
  const element = el('section', 'ui-panel ui-band ui-band--compact');
  const who = createWho();
  const status = el('span', 'ui-band__status');
  const head = el('div', 'ui-band__head');
  head.append(who, status);
  const hpValue = el('span', 'ui-band__value');
  const hp = healthBar('Vie');
  const hpRow = el('div', 'ui-band__row');
  hpRow.append(hp.bar, hpValue);
  element.append(head, hpRow);

  return {
    element,
    update(player) {
      fillWho(who, player);
      setVar(element, '--who', whoColor(player.classId));
      element.setAttribute('aria-label', who.textContent);
      updateHealth(element, hp.bar, hpValue, player);
      setText(status, player.downed ? 'À terre' : '');
    },
  };
}
