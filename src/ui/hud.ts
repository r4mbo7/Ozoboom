import type {
  ClassDefinition,
  GameContent,
  GaugeDefinition,
  SetDefinition,
  TrapDefinition,
} from '../data/types';
import { setFraction } from '../sim/lineup';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { UiFrame } from './types';
import type { PlayerId, PlayerState, SimState } from '../sim/state';
import { trapCapacity } from '../sim/stats';
import { t } from '../shared/i18n';
import { beatPeriodMs } from '../shared/tempo';
import { type Bracelet, createBracelet, createSkillView } from './bracelet';
import { createDashTile } from './dash-tile';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { formatNumber, ratio } from './format';
import {
  type GearSlotView,
  classToken,
  dropReading,
  enteredSpeaker,
  gaugeNotches,
  gaugeReading,
  gearSlots,
  handTiles,
  isNight,
  levelReading,
  plugHelp,
  rosterOf,
  skillCharge,
  sunPosition,
  trapToTake,
  volumeCrans,
} from './hud-model';
import { HEART, INFINITY, MOON, PAUSE, PLUG, SUN, skillIcon, trapIcon, weaponIcon } from './icons';
import { type LineupSlot, lineupCursor, lineupSlots, setOf, setTempo } from '../sim/lineup';
import { heldSlot, selectTrap } from './navigation';
import { promptsFor } from './prompts';
import { createWho, fillWho } from './who';
import { cssName } from './sun';

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  // Where what a player gains shows: their bracelet on a shared screen, else the slot of the circus
  // weapon or the level ring of the player of this screen. Null for a player the HUD does not show.
  landing(playerId: PlayerId, weaponId: string | null): HTMLElement | null;
  reset(): void;
}

export { skillCharge };

const CRITICAL_RATIO = 0.25;

function section(className: string, label: string): HTMLElement {
  const root = el('section', className);
  root.setAttribute('aria-label', label);
  return root;
}

function endlessMark(from: number | null | undefined): string | undefined {
  return from === undefined ? undefined : from === null ? 'ahead' : 'on';
}

function slotLabel(slot: LineupSlot): string {
  switch (slot.kind) {
    case 'phrase':
      return t('Palier {tier}, phrase {phrase}', {
        tier: formatNumber(slot.tier + 1),
        phrase: formatNumber(slot.phrase + 1),
      });
    case 'break':
      return t('Palier {tier}, break', { tier: formatNumber(slot.tier + 1) });
    case 'drop':
      return t('Palier {tier}, drop', { tier: formatNumber(slot.tier + 1) });
    case 'sunrise':
      return t('Sunrise');
  }
}

export function createHud(): Hud {
  const element = el('div', 'ui-screen ui-hud');

  const ribbon = section('ui-panel ui-hud__ribbon', t('Line-up'));
  const drop = el('div', 'ui-drop');
  const dropLabel = el('span', 'ui-drop__label', t('Drop'));
  const dropValue = el('span', 'ui-drop__value');
  dropValue.setAttribute('role', 'timer');
  dropValue.setAttribute('aria-label', t('Drop'));
  drop.append(dropLabel, dropValue);
  const lineupTrack = el('div', 'ui-lineup');
  const sky = el('div', 'ui-lineup__sky');
  sky.setAttribute('aria-hidden', 'true');
  const sun = el('span', 'ui-lineup__sun');
  sky.append(sun);
  const plugRow = el('div', 'ui-plugs');
  plugRow.setAttribute('role', 'meter');
  plugRow.setAttribute('aria-label', t('Enceintes branchées'));
  plugRow.setAttribute('aria-valuemin', '0');
  const pause = el('button', 'ui-hud__pause');
  pause.type = 'button';
  pause.tabIndex = -1;
  pause.setAttribute('aria-label', t('Pause'));
  pause.dataset.touchControl = 'pause';
  pause.append(icon('ui-hud__pause-icon', PAUSE));
  const timeline = el('div', 'ui-panel ui-hud__timeline');
  timeline.append(lineupTrack);
  ribbon.append(drop, timeline, plugRow, pause);

  const help = el('p', 'ui-hud__help');
  help.setAttribute('role', 'status');
  help.hidden = true;

  const bar = el('div', 'ui-panel ui-hud__bar');

  const level = section('ui-hud__level', t('Niveau'));
  const levelRing = el('div', 'ui-level');
  const levelNumber = el('span', 'ui-level__number');
  levelRing.append(levelNumber);
  level.append(levelRing);

  const life = section('ui-hud__life', t('Vie'));
  const lifeBar = el('div', 'ui-bar ui-life__bar');
  lifeBar.setAttribute('role', 'meter');
  lifeBar.setAttribute('aria-label', t('Vie'));
  lifeBar.setAttribute('aria-valuemin', '0');
  lifeBar.append(el('span', 'ui-bar__fill'));
  const lifeValue = el('span', 'ui-life__value');
  const lifeWho = createWho();
  const lifeIcon = icon('ui-life__icon', HEART);
  life.append(lifeWho, lifeIcon, lifeBar, lifeValue);

  const gear = section('ui-hud__gear', t('Agrès'));

  const traps = section('ui-hud__traps', t('Pièges'));
  const trapTiles = el('div', 'ui-traps');
  const cyclePrevious = el('span', 'ui-traps__cycle');
  const cycleNext = el('span', 'ui-traps__cycle');
  cyclePrevious.append(keycap('LB', 'button'));
  cycleNext.append(keycap('RB', 'button'));
  const trapName = el('div', 'ui-traps__name');
  traps.append(cyclePrevious, trapTiles, cycleNext, trapName);

  const skills = section('ui-hud__skills', t('Compétence'));
  const skill = createSkillView();
  skill.root.dataset.touchControl = 'skill';
  skills.append(skill.root);

  const dashTile = createDashTile();

  const gauge = section('ui-hud__gauge', t('Jauge'));
  gauge.hidden = true;
  const gaugeRing = el('div', 'ui-gauge__ring');
  gaugeRing.setAttribute('role', 'meter');
  gaugeRing.setAttribute('aria-valuemin', '0');
  gaugeRing.append(el('span', 'ui-gauge__core'));
  const gaugeName = el('span', 'ui-gauge__name');
  const gaugeStatus = el('span', 'ui-gauge__status');
  const gaugeText = el('div', 'ui-gauge__text');
  gaugeText.append(gaugeName, gaugeStatus);
  const gaugeView = el('div', 'ui-gauge');
  gaugeView.append(gaugeRing, gaugeText);
  gauge.append(gaugeView);

  const status = el('div', 'ui-panel ui-hud__status');
  status.append(level, life, gear);
  const actions = el('div', 'ui-panel ui-hud__actions');
  actions.append(traps, skills, dashTile.section, gauge);
  bar.append(status, actions);

  const bracelets = el('div', 'ui-hud__bracelets');
  bracelets.setAttribute('aria-label', t('Les joueurs'));
  const braceletViews: Bracelet[] = [];

  const top = el('div', 'ui-hud__top');
  top.append(ribbon, help);
  element.append(top, bracelets, bar);

  let builtFor: GameContent | null = null;
  let set: SetDefinition | null = null;
  let slots: HTMLElement[] = [];
  let slotDefs: LineupSlot[] = [];
  let tiles: HTMLElement[] = [];
  // The trap each tile shows, to redraw a tile only when its trap changes.
  let tileTraps: (string | null)[] = [];
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
  let shownLevel: Pick<PlayerState, 'level' | 'vibes'> | null = null;
  let shownPlayer: PlayerId | null = null;
  let braceleted: readonly PlayerState[] = [];

  function build(content: GameContent, setId: string): void {
    builtFor = content;
    set = setOf(content, setId);
    setVar(element, '--beat', `${beatPeriodMs(setTempo(set).bpm).toFixed(1)}ms`);
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
        node.append(icon('ui-slot__sun', SUN), icon('ui-slot__endless', INFINITY));
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
      plug.title = t(speaker.name);
      plug.append(icon('ui-plug__icon', PLUG));
      return plug;
    });
    plugRow.replaceChildren(...plugs);
    plugRow.setAttribute('aria-valuemax', String(plugs.length));
    plugRow.hidden = plugs.length === 0;

    selectedTrap = Math.min(selectedTrap, set.handSize - 1);
    trapDefinitions = new Map(content.traps.map((trap) => [trap.id, trap]));
    tiles = Array.from({ length: set.handSize }, (_, index) => {
      const tile = el('div', 'ui-trap');
      tile.dataset.touchControl = `trap:${String(index)}`;
      tile.append(el('span', 'ui-trap__key', String(index + 1)));
      return tile;
    });
    tileTraps = tiles.map(() => null);
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
    const counts = { plugged: formatNumber(plugged), total: formatNumber(levels.length) };
    plugRow.setAttribute(
      'aria-valuetext',
      plugged > 1
        ? t('{plugged} enceintes branchées sur {total}', counts)
        : t('{plugged} enceinte branchée sur {total}', counts),
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
      const name = t(view.weapon.name);
      chip.setAttribute(
        'aria-label',
        t('{weapon}, niveau {level}', { weapon: name, level: formatNumber(view.level) }),
      );
      chip.title = t('{name} : {description}', { name, description: t(view.weapon.description) });
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
    const name = t(definition.skill.name);
    setText(skill.name, name);
    skill.root.title = t('{name} : {description}', {
      name,
      description: t(definition.skill.description),
    });
    skill.key.replaceChildren(keycap(prompts.skill, prompts.style));
    setFlag(traps, 'gamepad', device === 'gamepad');
    setVar(element, '--who', `var(${cssName(classToken(definition.id))})`);
    buildGauge(definition.gauge);
  }

  function buildGauge(definition: GaugeDefinition | undefined): void {
    gauge.hidden = definition === undefined;
    if (definition === undefined) {
      return;
    }
    const name = t(definition.name);
    gauge.setAttribute('aria-label', name);
    gauge.title = name;
    gaugeRing.setAttribute('aria-label', name);
    gaugeRing.setAttribute('aria-valuemax', String(definition.max));
    setText(gaugeName, name);
    const notches = gaugeNotches(definition);
    setFlag(gaugeRing, 'notched', notches > 0);
    setVar(gaugeRing, '--notches', String(Math.max(1, notches)));
  }

  function updateGauge(player: PlayerState, definition: GaugeDefinition): void {
    const reading = gaugeReading(player, definition);
    setVar(gaugeRing, '--gauge-fill', String(reading.fill));
    gaugeRing.setAttribute('aria-valuenow', String(player.gauge ?? 0));
    gaugeRing.setAttribute('aria-valuetext', reading.text);
    setText(gaugeStatus, reading.text);
    setFlag(gauge, 'full', reading.full);
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

    // An endless game has no sunrise to reach: its last slot says so, lit once the last boss fell.
    const from = state.set.endlessFromTick;
    const last = slots.at(-1);
    if (last !== undefined && last.dataset.endless !== endlessMark(from)) {
      if (from === undefined) {
        delete last.dataset.endless;
      } else {
        last.dataset.endless = endlessMark(from);
      }
      last.title = from === undefined ? t('Sunrise') : t('Sans fin');
    }

    const reading = dropReading(set, state, content);
    setText(dropLabel, reading.label);
    setText(dropValue, reading.value);
    dropValue.hidden = reading.value === '';
    setFlag(ribbon, 'drop', reading.dropping);
    updateSun(setFraction(set, state));
  }

  function updateLevel(player: PlayerState): void {
    const reading = levelReading(shownLevel, player);
    if (shownLevel === null || reading.levelled) {
      levelRing.dataset.restart = '';
      setVar(levelRing, '--level-fill', '0');
      // Reading the style commits the empty ring: the fill then glides up from it, not back to it.
      void getComputedStyle(levelRing).getPropertyValue('--level-fill');
      delete levelRing.dataset.restart;
    }
    shownLevel = { level: player.level, vibes: player.vibes };
    setText(levelNumber, String(player.level));
    setVar(levelRing, '--level-fill', String(reading.fill));
    setFlag(level, 'near', reading.near);
    if (reading.gained) {
      levelRing.dataset.gain = levelRing.dataset.gain === 'a' ? 'b' : 'a';
    }
    if (reading.levelled) {
      levelRing.dataset.burst = levelRing.dataset.burst === 'a' ? 'b' : 'a';
    }
  }

  function updateLife(player: PlayerState, team: boolean): void {
    const fraction = ratio(player.hp, player.maxHp);
    setVar(lifeBar, '--fill', String(fraction));
    lifeBar.setAttribute('aria-valuemax', String(player.maxHp));
    lifeBar.setAttribute('aria-valuenow', String(Math.round(player.hp)));
    setText(lifeValue, formatNumber(player.hp));
    lifeWho.hidden = !team;
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
    braceleted = shown;
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
    shownPlayer = player?.id ?? null;
    if (player === undefined) {
      return;
    }
    const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
    if (definition !== null && (definition !== classDef || snapshot.device !== builtDevice)) {
      buildSkills(definition, snapshot.device);
    }

    updateLevel(player);
    level.title = t('Niveau {level} : {vibes} vibes sur {next}', {
      level: formatNumber(player.level),
      vibes: formatNumber(player.vibes),
      next: formatNumber(player.vibesToNextLevel),
    });
    updateLife(player, people.team);

    selectedTrap = selectTrap(selectedTrap, tiles.length, snapshot.gameplay, previousGameplay);
    previousGameplay = snapshot.gameplay;
    updateGear(player, state, content);
    updateHand(player, state);

    if (definition !== null) {
      const skillReady = player.skillCooldown <= 0;
      setVar(skill.root, '--charge', String(skillCharge(player, definition.skill)));
      setFlag(skill.root, 'ready', skillReady);
      setText(skill.status, skillReady ? t('Prête') : t('Recharge'));
      if (set !== null) {
        dashTile.update(player, content.dash, snapshot.device, state.tick, setTempo(set));
      }
      if (definition.gauge !== undefined) {
        updateGauge(player, definition.gauge);
      }
    }
  }

  function updateHand(player: PlayerState, state: SimState): void {
    const capacity = set === null ? 0 : trapCapacity(set, state);
    const views = handTiles(trapDefinitions, state, player, tiles.length, capacity);
    const selected = heldSlot(selectedTrap, player.hand?.length ?? 0);
    views.forEach((view, index) => {
      const tile = tiles[index];
      if (tile === undefined) {
        return;
      }
      if (tileTraps[index] !== view.trapId) {
        tileTraps[index] = view.trapId;
        const trap = view.trapId === null ? undefined : trapDefinitions.get(view.trapId);
        tile.querySelector('.ui-trap__icon')?.remove();
        if (trap !== undefined) {
          tile.append(icon('ui-trap__icon', trapIcon(trap.effect)));
        }
        tile.title =
          trap === undefined
            ? t('Main libre')
            : t('{name} : {description}', { name: t(trap.name), description: t(trap.description) });
      }
      setFlag(tile, 'empty', view.trapId === null);
      setFlag(tile, 'selected', index === selected);
      setFlag(tile, 'blocked', view.trapId !== null && !view.available);
    });
    const taken = trapToTake(trapDefinitions, state, player, tiles.length);
    const held = player.hand?.[selected];
    const name = (id: string | null | undefined) => {
      const trap = id === null || id === undefined ? undefined : trapDefinitions.get(id);
      return trap === undefined ? '' : t(trap.name);
    };
    setText(trapName, taken === null ? name(held) : t('Reprendre : {trap}', { trap: name(taken) }));
    trapName.hidden = taken === null && held === undefined;
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(measureSlots).observe(lineupTrack);
  }

  return {
    element,
    update,
    landing(playerId, weaponId) {
      if (element.dataset.multi !== undefined) {
        const worn = braceleted.findIndex((player) => player.id === playerId);
        return braceletViews[worn]?.element ?? null;
      }
      if (playerId !== shownPlayer) {
        return null;
      }
      // A short screen hides the gear: the card then lands on the level ring.
      const chip = chips.find((candidate) => candidate.dataset.weapon === weaponId);
      return chip !== undefined && chip.getClientRects().length > 0 ? chip : level;
    },
    reset() {
      selectedTrap = 0;
      previousGameplay = null;
      shownLevel = null;
      delete levelRing.dataset.gain;
      delete levelRing.dataset.burst;
    },
  };
}
