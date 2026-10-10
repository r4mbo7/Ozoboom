import type { ClassDefinition, GameContent, SetDefinition, TrapDefinition } from '../data/types';
import { setFraction } from '../sim/lineup';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { UiFrame } from './types';
import type { PlayerState, SimState } from '../sim/state';
import { trapCapacity } from '../sim/stats';
import { type Bracelet, createBracelet, createSkillView } from './bracelet';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { formatNumber, ratio } from './format';
import {
  type GearSlotView,
  classToken,
  dropReading,
  enteredSpeaker,
  gearSlots,
  isNight,
  plugHelp,
  rosterOf,
  skillCharge,
  sunPosition,
  trapTile,
  volumeCrans,
} from './hud-model';
import { BOLT, HEART, MOON, PAUSE, PLUG, SUN, skillIcon, trapIcon, weaponIcon } from './icons';
import { type LineupSlot, lineupCursor, lineupSlots, setOf } from '../sim/lineup';
import { selectTrap } from './navigation';
import { promptsFor } from './prompts';
import { createWho, fillWho } from './who';
import { cssName } from './sun';

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  reset(): void;
}

export { skillCharge };

const CRITICAL_RATIO = 0.25;

function section(className: string, label: string): HTMLElement {
  const root = el('section', className);
  root.setAttribute('aria-label', label);
  return root;
}

function slotLabel(slot: LineupSlot): string {
  switch (slot.kind) {
    case 'phrase':
      return `Palier ${String(slot.tier + 1)}, phrase ${String(slot.phrase + 1)}`;
    case 'break':
      return `Palier ${String(slot.tier + 1)}, break`;
    case 'drop':
      return `Palier ${String(slot.tier + 1)}, drop`;
    case 'sunrise':
      return 'Sunrise';
  }
}

export function createHud(): Hud {
  const element = el('div', 'ui-screen ui-hud');

  const ribbon = section('ui-panel ui-hud__ribbon', 'Line-up');
  const drop = el('div', 'ui-drop');
  const dropLabel = el('span', 'ui-drop__label', 'Drop');
  const dropValue = el('span', 'ui-drop__value');
  dropValue.setAttribute('role', 'timer');
  dropValue.setAttribute('aria-label', 'Drop');
  drop.append(dropLabel, dropValue);
  const lineupTrack = el('div', 'ui-lineup');
  const sky = el('div', 'ui-lineup__sky');
  sky.setAttribute('aria-hidden', 'true');
  const sun = el('span', 'ui-lineup__sun');
  sky.append(sun);
  const plugRow = el('div', 'ui-plugs');
  plugRow.setAttribute('role', 'meter');
  plugRow.setAttribute('aria-label', 'Enceintes branchées');
  plugRow.setAttribute('aria-valuemin', '0');
  const pause = el('button', 'ui-hud__pause');
  pause.type = 'button';
  pause.tabIndex = -1;
  pause.setAttribute('aria-label', 'Pause');
  pause.dataset.touchControl = 'pause';
  pause.append(icon('ui-hud__pause-icon', PAUSE));
  ribbon.append(drop, lineupTrack, plugRow, pause);

  const help = el('p', 'ui-hud__help');
  help.setAttribute('role', 'status');
  help.hidden = true;

  const bar = el('div', 'ui-panel ui-hud__bar');

  const level = section('ui-hud__level', 'Niveau');
  const levelRing = el('div', 'ui-level');
  const levelNumber = el('span', 'ui-level__number');
  levelRing.append(levelNumber);
  level.append(levelRing);

  const life = section('ui-hud__life', 'Vie');
  const lifeBar = el('div', 'ui-bar ui-life__bar');
  lifeBar.setAttribute('role', 'meter');
  lifeBar.setAttribute('aria-label', 'Vie');
  lifeBar.setAttribute('aria-valuemin', '0');
  lifeBar.append(el('span', 'ui-bar__fill'));
  const lifeValue = el('span', 'ui-life__value');
  const lifeWho = createWho();
  const lifeIcon = icon('ui-life__icon', HEART);
  life.append(lifeWho, lifeIcon, lifeBar, lifeValue);

  const gear = section('ui-hud__gear', 'Agrès');

  const traps = section('ui-hud__traps', 'Pièges');
  const watts = el('div', 'ui-watts');
  const wattsValue = el('span', 'ui-watts__value');
  const wattsAmount = el('span', 'ui-watts__amount');
  wattsAmount.append(icon('ui-watts__icon', BOLT), wattsValue);
  wattsAmount.title = 'Watts';
  const trapsCount = el('span', 'ui-traps__count');
  watts.append(wattsAmount, trapsCount);
  const trapTiles = el('div', 'ui-traps');
  const cyclePrevious = el('span', 'ui-traps__cycle');
  const cycleNext = el('span', 'ui-traps__cycle');
  cyclePrevious.append(keycap('LB', 'button'));
  cycleNext.append(keycap('RB', 'button'));
  const trapName = el('div', 'ui-traps__name');
  traps.append(watts, cyclePrevious, trapTiles, cycleNext, trapName);

  const skills = section('ui-hud__skills', 'Compétence');
  const skill = createSkillView();
  skill.root.dataset.touchControl = 'skill';
  skills.append(skill.root);

  bar.append(level, life, gear, traps, skills);

  const bracelets = el('div', 'ui-hud__bracelets');
  bracelets.setAttribute('aria-label', 'Les joueurs');
  const braceletViews: Bracelet[] = [];

  const top = el('div', 'ui-hud__top');
  top.append(ribbon, help);
  element.append(top, bracelets, bar);

  let builtFor: GameContent | null = null;
  let set: SetDefinition | null = null;
  let slots: HTMLElement[] = [];
  let slotDefs: LineupSlot[] = [];
  let tiles: HTMLElement[] = [];
  let tileCosts: HTMLElement[] = [];
  let trapDefinitions: ReadonlyMap<string, TrapDefinition> = new Map();
  let classDef: ClassDefinition | null = null;
  let builtDevice: InputDevice | null = null;
  let selectedTrap = 0;
  let previousGameplay: InputSnapshot['gameplay'] | null = null;
  let plugs: HTMLElement[] = [];
  let chips: HTMLElement[] = [];
  let gearKey: string | null = null;
  let slotEdges: { left: number; width: number }[] = [];
  let sunNight: boolean | null = null;
  let sunAt = -1;
  let beat = false;
  let helpSeen = false;
  let helpWasShown = false;

  function build(content: GameContent, setId: string): void {
    builtFor = content;
    set = setOf(content, setId);
    slots = [];
    slotDefs = lineupSlots(set);
    const groups: HTMLElement[] = [];
    let group: HTMLElement | null = null;
    for (const slot of slotDefs) {
      if (slot.kind === 'sunrise') {
        group = null;
      } else if (group === null || (slot.kind === 'phrase' && slot.phrase === 0)) {
        group = el('div', 'ui-lineup__tier');
        groups.push(group);
      }
      const node = el('span', `ui-slot ui-slot--${slot.kind}`);
      node.title = slotLabel(slot);
      if (slot.kind === 'sunrise') {
        node.append(icon('ui-slot__sun', SUN));
        groups.push(node);
      } else {
        group?.append(node);
      }
      slots.push(node);
    }
    lineupTrack.replaceChildren(sky, ...groups);
    measureSlots();

    plugs = (set.speakers ?? []).map((speaker) => {
      const plug = el('span', 'ui-plug');
      plug.title = speaker.name;
      plug.append(icon('ui-plug__icon', PLUG));
      return plug;
    });
    plugRow.replaceChildren(...plugs);
    plugRow.setAttribute('aria-valuemax', String(plugs.length));
    plugRow.hidden = plugs.length === 0;

    selectedTrap = Math.min(selectedTrap, Math.max(content.traps.length - 1, 0));
    trapDefinitions = new Map(content.traps.map((trap) => [trap.id, trap]));
    tileCosts = [];
    tiles = content.traps.map((trap, index) => {
      const tile = el('div', 'ui-trap');
      tile.title = `${trap.name} : ${trap.description}`;
      tile.dataset.touchControl = `trap:${String(index)}`;
      const amount = el('span', '', formatNumber(trap.cost));
      tileCosts.push(amount);
      const cost = el('span', 'ui-trap__cost');
      cost.append(icon('ui-trap__bolt', BOLT), amount);
      tile.append(
        el('span', 'ui-trap__key', String(index + 1)),
        icon('ui-trap__icon', trapIcon(trap.effect)),
        cost,
      );
      return tile;
    });
    trapTiles.replaceChildren(...tiles);
    classDef = null;
  }

  function measureSlots(): void {
    const width = lineupTrack.clientWidth;
    slotEdges =
      width === 0
        ? []
        : slots.map((slot) => ({ left: slot.offsetLeft / width, width: slot.offsetWidth / width }));
  }

  function updateSun(fraction: number): void {
    const edges =
      slotEdges.length === slots.length
        ? slotEdges
        : slots.map((_, index) => ({ left: index / slots.length, width: 1 / slots.length }));
    const at = sunPosition(fraction, edges);
    if (Math.abs(at - sunAt) > 0.0005) {
      sunAt = at;
      setVar(sky, '--sun', String(at));
    }
    const night = isNight(fraction);
    if (night !== sunNight) {
      sunNight = night;
      sun.replaceChildren(icon('ui-lineup__glyph', night ? MOON : SUN));
    }
  }

  function updateSpeakers(state: SimState): void {
    if (set === null) {
      return;
    }
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
    const plugged = state.volume ?? 0;
    plugRow.setAttribute('aria-valuenow', String(plugged));
    plugRow.setAttribute(
      'aria-valuetext',
      `${String(plugged)} enceinte${plugged > 1 ? 's' : ''} branchée${plugged > 1 ? 's' : ''} sur ${String(levels.length)}`,
    );
    if (state.events.some((event) => event.type === 'volumeChanged')) {
      beat = !beat;
      plugRow.dataset.bump = beat ? 'a' : 'b';
    }

    const entered = helpSeen ? null : enteredSpeaker(set, state);
    if (entered !== null) {
      setText(help, plugHelp(entered.plugBars));
      helpWasShown = true;
    } else if (helpWasShown) {
      helpSeen = true;
    }
    help.hidden = entered === null;
  }

  function buildGear(held: readonly GearSlotView[]): void {
    chips = held.flatMap((view) => {
      if (view.weapon === null) {
        return [];
      }
      const chip = el('div', 'ui-gear');
      chip.setAttribute('role', 'img');
      chip.setAttribute('aria-label', `${view.weapon.name}, niveau ${String(view.level)}`);
      chip.title = `${view.weapon.name} : ${view.weapon.description}`;
      chip.dataset.weapon = view.weapon.id;
      if (view.weapon.rhythm === 'continuous') {
        chip.dataset.continuous = '';
      }
      const dots = el('span', 'ui-gear__dots');
      for (let rank = 1; rank <= view.weapon.maxLevel; rank += 1) {
        const dot = el('span', 'ui-gear__dot');
        setFlag(dot, 'on', rank <= view.level);
        dots.append(dot);
      }
      chip.append(icon('ui-gear__icon', weaponIcon(view.weapon.effect)), dots);
      return [chip];
    });
    gear.replaceChildren(...chips);
    gear.hidden = chips.length === 0;
  }

  function updateGear(player: PlayerState, state: SimState, content: GameContent): void {
    const held = gearSlots(player, content).filter((view) => view.weapon !== null);
    const key = held.map((view) => `${view.weapon?.id ?? '-'}:${String(view.level)}`).join(',');
    if (key !== gearKey) {
      gearKey = key;
      buildGear(held);
    }
    for (const event of state.events) {
      if (event.type !== 'weaponFired' || event.playerId !== player.id) {
        continue;
      }
      const chip = chips.find((view) => view.dataset.weapon === event.weaponId);
      if (chip !== undefined && chip.dataset.continuous === undefined) {
        beat = !beat;
        chip.dataset.pulse = beat ? 'a' : 'b';
      }
    }
  }

  function buildSkills(definition: ClassDefinition, device: InputDevice): void {
    classDef = definition;
    builtDevice = device;
    const prompts = promptsFor(device);
    skill.glyph.replaceChildren(icon('ui-skill__icon', skillIcon(definition.skill.effect)));
    setText(skill.name, definition.skill.name);
    skill.root.title = `${definition.skill.name} : ${definition.skill.description}`;
    skill.key.replaceChildren(keycap(prompts.skill, prompts.style));
    setFlag(traps, 'gamepad', device === 'gamepad');
    setVar(element, '--who', `var(${cssName(classToken(definition.id))})`);
  }

  function updateLineup(state: SimState, content: GameContent): void {
    if (set === null) {
      return;
    }
    const cursor = lineupCursor(set, state);
    slots.forEach((slot, index) => {
      const status = index < cursor.slot ? 'done' : index === cursor.slot ? 'current' : 'next';
      if (slot.dataset.state !== status) {
        slot.dataset.state = status;
      }
      if (index === cursor.slot) {
        setVar(slot, '--fill', String(cursor.fraction ?? 1));
        setFlag(slot, 'open', cursor.fraction === null);
      }
    });

    const reading = dropReading(set, state, content);
    setText(dropLabel, reading.label);
    setText(dropValue, reading.value);
    dropValue.hidden = reading.value === '';
    setFlag(ribbon, 'drop', reading.dropping);
    updateSun(setFraction(set, state));
  }

  function updateLife(player: PlayerState): void {
    const fraction = ratio(player.hp, player.maxHp);
    setVar(lifeBar, '--fill', String(fraction));
    lifeBar.setAttribute('aria-valuemax', String(player.maxHp));
    lifeBar.setAttribute('aria-valuenow', String(Math.round(player.hp)));
    setText(lifeValue, formatNumber(player.hp));
    lifeWho.hidden = player.name === undefined;
    lifeIcon.hidden = !lifeWho.hidden;
    if (!lifeWho.hidden) {
      fillWho(lifeWho, player);
    }
    setFlag(life, 'critical', fraction <= CRITICAL_RATIO);
  }

  // On a shared screen every player wears a bracelet; online, the players of other screens do.
  function updateBracelets(
    frame: UiFrame,
    content: GameContent,
    locals: readonly PlayerState[],
    others: readonly PlayerState[],
  ): void {
    const shown = locals.length > 1 ? [...locals, ...others] : others;
    while (braceletViews.length < shown.length) {
      const view = createBracelet();
      braceletViews.push(view);
      bracelets.append(view.element);
    }
    while (braceletViews.length > shown.length) {
      braceletViews.pop()?.element.remove();
    }
    shown.forEach((player, index) => {
      const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
      const local = frame.players.find((entry) => entry.playerId === player.id);
      const device = locals.includes(player)
        ? (local?.snapshot.device ?? frame.snapshot.device)
        : null;
      braceletViews[index]?.update(player, definition, device);
    });
  }

  function update(state: SimState, frame: UiFrame, content: GameContent): void {
    if (builtFor !== content || set?.id !== state.setId) {
      build(content, state.setId);
    }
    updateLineup(state, content);
    updateSpeakers(state);

    const people = rosterOf(state, frame);
    setFlag(element, 'team', people.team);
    setFlag(element, 'multi', people.team && people.locals.length > 1);
    updateBracelets(frame, content, people.team ? people.locals : [], people.others);

    const local = frame.players[0];
    const snapshot = local?.snapshot ?? frame.snapshot;
    const player = state.players.find((candidate) => candidate.id === local?.playerId);
    setFlag(element, 'no-player', player === undefined);
    if (player === undefined) {
      return;
    }
    const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
    if (definition !== null && (definition !== classDef || snapshot.device !== builtDevice)) {
      buildSkills(definition, snapshot.device);
    }

    setText(levelNumber, String(player.level));
    setVar(levelRing, '--fill', String(ratio(player.vibes, player.vibesToNextLevel)));
    level.title = `Niveau ${String(player.level)} : ${formatNumber(player.vibes)} vibes sur ${formatNumber(player.vibesToNextLevel)}`;
    updateLife(player);

    selectedTrap = selectTrap(selectedTrap, tiles.length, snapshot.gameplay, previousGameplay);
    previousGameplay = snapshot.gameplay;
    const maxTraps = set === null ? 0 : trapCapacity(set, state);
    updateGear(player, state, content);
    setText(wattsValue, formatNumber(state.core.watts));
    setText(trapsCount, `${String(state.traps.length)} / ${String(maxTraps)} posés`);
    content.traps.forEach((trap, index) => {
      const tile = tiles[index];
      if (tile === undefined) {
        return;
      }
      const view = trapTile(trapDefinitions, state, player, trap.id, maxTraps);
      setFlag(tile, 'selected', index === selectedTrap);
      setFlag(tile, 'unaffordable', !view.available);
      const amount = tileCosts[index];
      if (amount !== undefined) {
        setText(amount, formatNumber(view.cost));
      }
    });
    setText(trapName, content.traps[selectedTrap]?.name ?? '');

    if (definition !== null) {
      const skillReady = player.skillCooldown <= 0;
      setVar(skill.root, '--charge', String(skillCharge(player, definition.skill)));
      setFlag(skill.root, 'ready', skillReady);
      setText(skill.status, skillReady ? 'Prête' : 'Recharge');
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(measureSlots).observe(lineupTrack);
  }

  return {
    element,
    update,
    reset() {
      selectedTrap = 0;
      previousGameplay = null;
    },
  };
}
