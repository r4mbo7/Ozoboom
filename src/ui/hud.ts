import type { ClassDefinition, GameContent, SetDefinition, SkillDefinition } from '../data/types';
import { setFraction } from '../sim/lineup';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerState, SimState } from '../sim/state';
import { skillCooldownTicks, statValue } from '../sim/stats';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { formatDuration, formatNumber, formatPercent, ratio } from './format';
import {
  GEAR_SLOTS,
  type GearSlotView,
  enteredSpeaker,
  gearSlots,
  isNight,
  plugHelp,
  sunPosition,
  trapCapacity,
  volumeCrans,
} from './hud-model';
import { BOLT, FOG, MOON, SUN, skillIcon, trapIcon, weaponIcon } from './icons';
import { type LineupSlot, lineupCursor, lineupSlots, setOf, ticksToDrop } from '../sim/lineup';
import { selectTrap } from './navigation';
import { promptsFor } from './prompts';
import { cssName } from './sun';

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, snapshot: InputSnapshot, content: GameContent): void;
  reset(): void;
}

export function skillCharge(
  player: Pick<PlayerState, 'modifiers' | 'skillCooldown'>,
  skill: Pick<SkillDefinition, 'cooldownTicks'>,
): number {
  return 1 - ratio(player.skillCooldown, skillCooldownTicks(player, skill));
}

const VU_SEGMENTS = 20;
const CRITICAL_RATIO = 0.25;

interface SkillView {
  root: HTMLElement;
  glyph: HTMLElement;
  name: HTMLElement;
  key: HTMLElement;
  status: HTMLElement;
}

function panel(area: string, label: string): { root: HTMLElement; head: HTMLElement } {
  const root = el('section', `ui-panel ui-hud__${area}`);
  root.setAttribute('aria-label', label);
  const head = el('div', 'ui-panel__head');
  root.append(head);
  return { root, head };
}

function createSkillView(kind: 'skill' | 'ultimate'): SkillView {
  const root = el('div', `ui-skill ui-skill--${kind}`);
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

  const core = panel('core', 'Scène');
  const coreLabel = el('span', 'ui-panel__label', 'Scène');
  const coreValue = el('span', 'ui-panel__value');
  core.head.append(coreLabel, coreValue);
  const vu = el('div', 'ui-vu');
  vu.setAttribute('role', 'meter');
  vu.setAttribute('aria-label', 'Vie de la scène');
  vu.setAttribute('aria-valuemin', '0');
  vu.setAttribute('aria-valuemax', '100');
  const vuSegments = Array.from({ length: VU_SEGMENTS }, (_, index) => {
    const segment = el('span', 'ui-vu__seg');
    segment.style.setProperty('--i', String(index));
    return segment;
  });
  vu.append(...vuSegments);
  core.root.append(vu);

  const lineup = panel('lineup', 'Line-up');
  const lineupNow = el('span', 'ui-panel__label ui-lineup__now');
  const lineupNext = el('span', 'ui-lineup__next');
  lineup.head.append(lineupNow, lineupNext);
  const lineupTrack = el('div', 'ui-lineup');
  const sky = el('div', 'ui-lineup__sky');
  sky.setAttribute('aria-hidden', 'true');
  const sun = el('span', 'ui-lineup__sun');
  sky.append(sun);
  lineup.root.append(lineupTrack);

  const threat = panel('threat', 'Bad vibes');
  threat.head.append(el('span', 'ui-panel__label', 'Bad vibes'));
  const threatCount = el('span', 'ui-threat__count');
  const threatRow = el('div', 'ui-threat');
  threatRow.append(icon('ui-threat__icon', FOG), threatCount);
  threat.root.append(threatRow);

  const level = panel('level', 'Niveau');
  const levelBadge = el('div', 'ui-level__badge');
  const levelNumber = el('span', 'ui-level__number');
  levelBadge.append(el('span', 'ui-level__abbr', 'Niv.'), levelNumber);
  const vibesValue = el('span', 'ui-panel__value ui-panel__value--small');
  level.head.append(el('span', 'ui-panel__label', 'Vibes'), vibesValue);
  const vibesBar = el('div', 'ui-bar');
  vibesBar.append(el('span', 'ui-bar__fill'));
  const levelBody = el('div', 'ui-level__body');
  levelBody.append(level.head, vibesBar);
  level.root.append(levelBadge, levelBody);

  const traps = panel('traps', 'Pièges');
  const watts = el('span', 'ui-watts');
  const wattsValue = el('span', 'ui-watts__value');
  watts.append(icon('ui-watts__icon', BOLT), wattsValue, el('span', 'ui-watts__unit', 'watts'));
  const trapsCount = el('span', 'ui-traps__count');
  traps.head.append(watts, trapsCount);
  const trapTiles = el('div', 'ui-traps');
  const trapRow = el('div', 'ui-traps__row');
  const cyclePrevious = el('span', 'ui-traps__cycle');
  const cycleNext = el('span', 'ui-traps__cycle');
  cyclePrevious.append(keycap('LB', 'button'));
  cycleNext.append(keycap('RB', 'button'));
  trapRow.append(cyclePrevious, trapTiles, cycleNext);
  const trapName = el('div', 'ui-traps__name');
  traps.root.append(trapRow, trapName);

  const skills = panel('skills', 'Compétences');
  skills.head.remove();
  const skill = createSkillView('skill');
  const ultimate = createSkillView('ultimate');
  skills.root.append(skill.root, ultimate.root);

  const volume = panel('volume', 'Volume');
  const volumeValue = el('span', 'ui-panel__value ui-panel__value--small');
  volume.head.append(el('span', 'ui-panel__label', 'Volume'), volumeValue);
  const cranRow = el('div', 'ui-crans');
  cranRow.setAttribute('role', 'meter');
  cranRow.setAttribute('aria-label', 'Volume');
  cranRow.setAttribute('aria-valuemin', '0');
  const volumeHelp = el('p', 'ui-volume__help');
  volumeHelp.setAttribute('role', 'status');
  volumeHelp.hidden = true;
  volume.root.append(cranRow, volumeHelp);

  const gear = panel('gear', 'Agrès');
  gear.head.remove();
  const gearRow = el('div', 'ui-gear');
  gear.root.append(gearRow);

  const aux = el('div', 'ui-hud__aux');
  aux.append(volume.root, gear.root);

  element.append(core.root, lineup.root, threat.root, aux, level.root, traps.root, skills.root);

  let builtFor: GameContent | null = null;
  let set: SetDefinition | null = null;
  let slots: HTMLElement[] = [];
  let slotDefs: LineupSlot[] = [];
  let tiles: HTMLElement[] = [];
  let classDef: ClassDefinition | null = null;
  let builtDevice: InputDevice | null = null;
  let selectedTrap = 0;
  let previousGameplay: InputSnapshot['gameplay'] | null = null;
  let litSegments = -1;
  let crans: HTMLElement[] = [];
  let gearViews: HTMLElement[] = [];
  let gearKey = '';
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

    crans = (set.speakers ?? []).map((speaker) => {
      const cran = el('span', 'ui-cran');
      cran.title = speaker.name;
      return cran;
    });
    cranRow.replaceChildren(...crans);
    cranRow.setAttribute('aria-valuemax', String(crans.length));
    volume.root.hidden = crans.length === 0;

    selectedTrap = Math.min(selectedTrap, Math.max(content.traps.length - 1, 0));
    tiles = content.traps.map((trap, index) => {
      const tile = el('div', 'ui-trap');
      tile.title = `${trap.name} : ${trap.description}`;
      const cost = el('span', 'ui-trap__cost');
      cost.append(icon('ui-trap__bolt', BOLT), el('span', '', formatNumber(trap.cost)));
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

  function updateVolume(state: SimState): void {
    if (set === null) {
      return;
    }
    const levels = volumeCrans(set, state);
    levels.forEach((level, index) => {
      const cran = crans[index];
      if (cran === undefined) {
        return;
      }
      setVar(cran, '--cran', `var(${cssName(level.token)})`);
      setVar(cran, '--fill', String(level.fill));
      cran.dataset.state = level.state;
    });
    const volumeNow = state.volume ?? 0;
    setText(volumeValue, `${String(volumeNow)} / ${String(levels.length)}`);
    cranRow.setAttribute('aria-valuenow', String(volumeNow));
    cranRow.setAttribute(
      'aria-valuetext',
      `Volume ${String(volumeNow)} sur ${String(levels.length)}`,
    );
    if (state.events.some((event) => event.type === 'volumeChanged')) {
      beat = !beat;
      volume.root.dataset.bump = beat ? 'a' : 'b';
    }

    const entered = helpSeen ? null : enteredSpeaker(set, state);
    if (entered !== null) {
      setText(volumeHelp, plugHelp(entered.plugBars));
      helpWasShown = true;
    } else if (helpWasShown) {
      helpSeen = true;
    }
    volumeHelp.hidden = entered === null;
  }

  function buildGear(views: readonly GearSlotView[]): void {
    gearViews = views.map((view) => {
      const slot = el('div', 'ui-gear__slot');
      if (view.weapon === null) {
        slot.dataset.empty = '';
        slot.setAttribute('aria-label', 'Emplacement libre');
        return slot;
      }
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', `${view.weapon.name}, niveau ${String(view.level)}`);
      slot.title = `${view.weapon.name} : ${view.weapon.description}`;
      slot.dataset.weapon = view.weapon.id;
      if (view.weapon.rhythm === 'continuous') {
        slot.dataset.continuous = '';
      }
      const dots = el('span', 'ui-gear__dots');
      for (let level = 1; level <= view.weapon.maxLevel; level += 1) {
        const dot = el('span', 'ui-gear__dot');
        setFlag(dot, 'on', level <= view.level);
        dots.append(dot);
      }
      slot.append(icon('ui-gear__icon', weaponIcon(view.weapon.effect)), dots);
      return slot;
    });
    gearRow.replaceChildren(...gearViews);
  }

  function updateGear(player: PlayerState, state: SimState, content: GameContent): void {
    const views = gearSlots(player, content);
    const key = views.map((view) => `${view.weapon?.id ?? '-'}:${String(view.level)}`).join(',');
    if (key !== gearKey || gearViews.length !== GEAR_SLOTS) {
      gearKey = key;
      buildGear(views);
    }
    for (const event of state.events) {
      if (event.type !== 'weaponFired' || event.playerId !== player.id) {
        continue;
      }
      const slot = gearViews.find((view) => view.dataset.weapon === event.weaponId);
      if (slot !== undefined && slot.dataset.continuous === undefined) {
        beat = !beat;
        slot.dataset.pulse = beat ? 'a' : 'b';
      }
    }
  }

  function buildSkills(definition: ClassDefinition, device: InputDevice): void {
    classDef = definition;
    builtDevice = device;
    const prompts = promptsFor(device);
    const fill = (view: SkillView, def: SkillDefinition, key: string): void => {
      view.glyph.replaceChildren(icon('ui-skill__icon', skillIcon(def.effect)));
      setText(view.name, def.name);
      view.key.replaceChildren(keycap(key, prompts.style));
    };
    fill(skill, definition.skill, prompts.skill);
    fill(ultimate, definition.ultimate, prompts.ultimate);
    setFlag(traps.root, 'gamepad', device === 'gamepad');
  }

  function updateCore(state: SimState): void {
    const fraction = ratio(state.core.hp, state.core.maxHp);
    const lit = Math.ceil(fraction * VU_SEGMENTS);
    if (lit !== litSegments) {
      litSegments = lit;
      vuSegments.forEach((segment, index) => {
        setFlag(segment, 'on', index < lit);
      });
    }
    setText(coreValue, formatPercent(fraction));
    vu.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    setFlag(core.root, 'critical', fraction <= CRITICAL_RATIO);
    setText(coreLabel, fraction <= CRITICAL_RATIO ? 'Scène en danger' : 'Scène');
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

    const tier = set.tiers[state.set.tier];
    const tierText = `Palier ${String(state.set.tier + 1)}/${String(set.tiers.length)}`;
    const boss = content.enemies.find((enemy) => enemy.id === tier?.bossId)?.name ?? 'le boss';
    const toDrop = ticksToDrop(set, state);
    if (state.status === 'won' || tier === undefined) {
      setText(lineupNow, 'Sunrise');
      setText(lineupNext, 'Le soleil se lève');
    } else if (state.set.segment === 'buildup') {
      const phrase = (slotDefs[cursor.slot]?.phrase ?? 0) + 1;
      setText(lineupNow, `${tierText} · phrase ${String(phrase)}/${String(tier.buildupPhrases)}`);
      setText(lineupNext, `Drop dans ${formatDuration(toDrop ?? 0)}`);
    } else if (state.set.segment === 'break') {
      setText(lineupNow, `${tierText} · break, souffle`);
      setText(lineupNext, `Drop dans ${formatDuration(toDrop ?? 0)}`);
    } else {
      setText(lineupNow, `${tierText} · drop`);
      setText(lineupNext, `${boss} est là`);
    }
    setFlag(lineup.root, 'drop', state.set.segment === 'drop' && state.status !== 'won');
    updateSun(setFraction(set, state));
  }

  function update(state: SimState, snapshot: InputSnapshot, content: GameContent): void {
    if (builtFor !== content || set?.id !== state.setId) {
      build(content, state.setId);
    }
    updateCore(state);
    updateLineup(state, content);
    setText(threatCount, formatNumber(state.enemies.length));
    updateVolume(state);

    const player = state.players[0];
    setFlag(element, 'no-player', player === undefined);
    if (player === undefined) {
      return;
    }
    const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
    if (definition !== null && (definition !== classDef || snapshot.device !== builtDevice)) {
      buildSkills(definition, snapshot.device);
    }

    setText(levelNumber, String(player.level));
    setText(vibesValue, `${formatNumber(player.vibes)} / ${formatNumber(player.vibesToNextLevel)}`);
    setVar(vibesBar, '--fill', String(ratio(player.vibes, player.vibesToNextLevel)));

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
      setFlag(tile, 'selected', index === selectedTrap);
      setFlag(
        tile,
        'unaffordable',
        statValue(player, 'trapCostMul', trap.cost) > state.core.watts ||
          state.traps.length >= maxTraps,
      );
    });
    setText(trapName, content.traps[selectedTrap]?.name ?? '');

    if (definition !== null) {
      const skillReady = player.skillCooldown <= 0;
      setVar(skill.root, '--charge', String(skillCharge(player, definition.skill)));
      setFlag(skill.root, 'ready', skillReady);
      setText(skill.status, skillReady ? 'Prête' : 'Recharge');
      setVar(ultimate.root, '--charge', player.ultimateReady ? '1' : '0');
      setFlag(ultimate.root, 'ready', player.ultimateReady);
      setText(ultimate.status, player.ultimateReady ? 'Prêt' : 'Au drop');
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
