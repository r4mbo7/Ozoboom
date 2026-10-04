import type { ClassDefinition, GameContent, SetDefinition, SkillDefinition } from '../data/types';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { SimState } from '../sim/state';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { formatDuration, formatNumber, formatPercent, ratio } from './format';
import { BOLT, FOG, SUN, skillIcon, trapIcon } from './icons';
import { type LineupSlot, lineupCursor, lineupSlots, setOf, ticksToDrop } from './lineup';
import { selectTrap } from './navigation';
import { promptsFor } from './prompts';

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, snapshot: InputSnapshot, content: GameContent): void;
  reset(): void;
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
  vu.setAttribute('aria-label', 'Volume de la scène');
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

  element.append(core.root, lineup.root, threat.root, level.root, traps.root, skills.root);

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
    lineupTrack.replaceChildren(...groups);

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
  }

  function update(state: SimState, snapshot: InputSnapshot, content: GameContent): void {
    if (builtFor !== content || set?.id !== state.setId) {
      build(content, state.setId);
    }
    updateCore(state);
    updateLineup(state, content);
    setText(threatCount, formatNumber(state.enemies.length));

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
    const costMul = player.modifiers.trapCostMul ?? 1;
    const maxTraps = set?.maxTraps ?? 0;
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
        trap.cost * costMul > state.core.watts || state.traps.length >= maxTraps,
      );
    });
    setText(trapName, content.traps[selectedTrap]?.name ?? '');

    if (definition !== null) {
      const total = definition.skill.cooldownTicks * (player.modifiers.skillCooldownMul ?? 1);
      const charge = total > 0 ? 1 - ratio(player.skillCooldown, total) : 1;
      const skillReady = player.skillCooldown <= 0;
      setVar(skill.root, '--charge', String(skillReady ? 1 : charge));
      setFlag(skill.root, 'ready', skillReady);
      setText(skill.status, skillReady ? 'Prête' : 'Recharge');
      setVar(ultimate.root, '--charge', player.ultimateReady ? '1' : '0');
      setFlag(ultimate.root, 'ready', player.ultimateReady);
      setText(ultimate.status, player.ultimateReady ? 'Prêt' : 'Au drop');
    }
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
