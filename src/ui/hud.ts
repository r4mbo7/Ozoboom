import type { ClassDefinition, GameContent, SetDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import { type Tempo, beatPeriodMs } from '../shared/tempo';
import { weaponSlotCount } from '../sim/draw';
import { playedTempo, setOf, setTempo } from '../sim/lineup';
import type { PlayerId, PlayerState, SimState } from '../sim/state';
import { createBossBanner } from './boss-banner';
import { createBraceletRow } from './bracelet-row';
import { createDashTile } from './dash-tile';
import { el, icon, replay, setFlag, setText, setVar } from './dom';
import { FULL_HUD } from './full';
import { createGaugeTile } from './gauge-tile';
import { createGearPlaces } from './gear-places';
import type { WeaponPlace } from './cards';
import {
  type Roster,
  type PotionReading,
  type TwinVibesReading,
  allDown,
  classToken,
  deepestDanger,
  rosterOf,
  potionReading,
  twinVibesReading,
} from './hud-model';
import { PAUSE } from './icons';
import { createLevelRing } from './level-ring';
import { createLineupRibbon } from './lineup-ribbon';
import type { Prompts } from './prompts';
import { createSkillTile } from './skill-tile';
import { createSpeakerPlugs } from './speaker-plugs';
import { cssName } from './sun';
import { createVibeCounter } from './vibe-counter';
import { createCarriedTrap } from './carried-trap';
import type { UiFrame } from './types';
import { type TutorialBanner, createTutorialBanner } from './tutorial';

// The frame's depth moves in twentieths: finer steps repaint the whole screen for nothing seen.
const DEPTH_STEPS = 20;

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  // A bracelet on a shared screen, else the circus weapon slot or the level ring; null for a player the HUD does not show.
  landing(playerId: PlayerId, weaponId: string | null): HTMLElement | null;
  // The bar shows the places of an offer while its player chooses; null when it does not show that player.
  offerPlaces(playerId: PlayerId, places: readonly WeaponPlace[] | null): HTMLElement | null;
  reset(): void;
  readonly tutorial: TutorialBanner;
}

function pauseButton(): HTMLButtonElement {
  const pause = el('button', 'ui-hud__pause');
  pause.type = 'button';
  pause.tabIndex = -1;
  pause.setAttribute('aria-label', t('Pause'));
  pause.dataset.touchControl = 'pause';
  pause.append(icon('ui-hud__pause-icon', PAUSE));
  return pause;
}

function shownPlayer(state: SimState, frame: UiFrame): PlayerState | undefined {
  const local = frame.players[0];
  return state.players.find((candidate) => candidate.id === local?.playerId);
}

export function createHud(prompts: Prompts): Hud {
  const element = el('div', 'ui-screen ui-hud');
  const ribbon = createLineupRibbon();
  const plugs = createSpeakerPlugs();
  // A shared screen has no level ring in its bar: its team's vibes show in the top bar instead.
  const ribbonVibes = createVibeCounter();
  ribbon.element.append(plugs.row, ribbonVibes.element, pauseButton());
  const level = createLevelRing();
  const vibes = createVibeCounter();
  const gear = createGearPlaces();
  const carried = createCarriedTrap(prompts);
  const skill = createSkillTile(prompts);
  const dashTile = createDashTile();
  const gauge = createGaugeTile();
  const bar = el('div', 'ui-panel ui-hud__bar');
  const status = el('div', 'ui-panel ui-hud__status');
  status.append(level.element, vibes.element, gear.element);
  const actions = el('div', 'ui-panel ui-hud__actions');
  actions.append(carried.element, skill.element, dashTile.section, gauge.element);
  bar.append(status, actions);
  const bracelets = createBraceletRow(prompts);
  const top = el('div', 'ui-hud__top');
  const tutorial = createTutorialBanner();
  top.append(ribbon.element, tutorial.element, plugs.help);
  const banner = createBossBanner();
  const danger = el('div', 'ui-hud__danger');
  danger.setAttribute('aria-hidden', 'true');
  const twinsFrame = el('div', 'ui-hud__twins');
  twinsFrame.setAttribute('aria-hidden', 'true');
  const watched = el('p', 'ui-hud__watched');
  watched.setAttribute('role', 'status');
  const potionFrame = el('div', 'ui-hud__potion');
  potionFrame.setAttribute('aria-hidden', 'true');

  element.append(
    danger,
    twinsFrame,
    potionFrame,
    watched,
    top,
    banner.element,
    bracelets.element,
    bar,
  );
  const parts = Object.values(FULL_HUD).map((create) =>
    create({ ribbon: ribbon.element, overlay: element }),
  );

  let built: { content: GameContent; set: SetDefinition } | null = null;
  let dressed: { definition: ClassDefinition; device: InputDevice; keys: number } | null = null;
  let shownId: PlayerId | null = null;
  let heartBeat = Number.NaN;

  function build(content: GameContent, setId: string): SetDefinition {
    const set = setOf(content, setId);
    built = { content, set };
    setVar(element, '--beat', `${beatPeriodMs(setTempo(set).bpm).toFixed(1)}ms`);
    ribbon.build(set);
    plugs.build(set);
    carried.build(content);
    dressed = null;
    return set;
  }

  function dress(definition: ClassDefinition, device: InputDevice): void {
    if (
      definition === dressed?.definition &&
      device === dressed.device &&
      dressed.keys === prompts.version()
    ) {
      return;
    }
    dressed = { definition, device, keys: prompts.version() };
    tutorial.setDevice(prompts.for(device), device === 'touch');
    skill.build(definition.skill, device);
    carried.setDevice(device);
    setVar(element, '--who', `var(${cssName(classToken(definition.id))})`);
    gauge.build(definition.gauge);
  }

  function showTeam(frame: UiFrame, content: GameContent, people: Roster): void {
    setFlag(element, 'team', people.team);
    setFlag(element, 'multi', people.team && people.locals.length > 1);
    bracelets.update(frame, content, people);
    const down = allDown(people.locals);
    setFlag(element, 'watched', down);
    setText(watched, down ? t('The fireflies are watching over you') : '');
  }

  function showDanger(people: Roster, beat: number): void {
    const depth = deepestDanger(people.locals);
    setFlag(element, 'danger', depth !== null);
    const beaten = beat !== heartBeat;
    heartBeat = beat;
    if (depth === null) {
      // Coming back, the frame waits for a beat: a mark left from before would beat at once.
      delete danger.dataset.beat;
      return;
    }
    setVar(danger, '--danger-depth', (Math.round(depth * DEPTH_STEPS) / DEPTH_STEPS).toFixed(2));
    if (beaten) {
      replay(danger, 'beat');
    }
  }

  function showTwinVibes(twins: TwinVibesReading | null): void {
    setFlag(element, 'twins', twins !== null);
    setFlag(element, 'twins-ending', twins?.ending === true);
    setVar(twinsFrame, '--twins-left', String(twins?.left ?? 0));
  }

  function showPotion(potion: PotionReading | null): void {
    setFlag(element, 'potion', potion !== null);
    setFlag(element, 'potion-ending', potion?.ending === true);
    setVar(potionFrame, '--potion-left', String(potion?.left ?? 0));
  }

  function showPlayer(
    player: PlayerState,
    state: SimState,
    frame: UiFrame,
    content: GameContent,
    set: SetDefinition,
    tempo: Tempo,
    twins: TwinVibesReading | null,
  ): void {
    const snapshot = frame.players[0]?.snapshot ?? frame.snapshot;
    const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
    if (definition !== null) {
      dress(definition, snapshot.device);
    }
    level.update(player, twins);
    gear.update(player, state, content, weaponSlotCount(set));
    carried.update(player, state, content);
    if (definition !== null) {
      skill.update(player, definition.skill);
      dashTile.update(player, content.dash, snapshot.device, state.tick, tempo);
      if (definition.gauge !== undefined) {
        gauge.update(player, definition.gauge);
      }
    }
  }

  function update(state: SimState, frame: UiFrame, content: GameContent): void {
    const set =
      built?.content === content && built.set.id === state.setId
        ? built.set
        : build(content, state.setId);
    const tempo = playedTempo(set, state);
    ribbon.update(set, state);
    vibes.update(state, tempo.ticksPerBeat);
    ribbonVibes.update(state, tempo.ticksPerBeat);
    plugs.update(set, state);
    tutorial.follow(set, state);
    banner.update(state, content);
    for (const part of parts) {
      part.update(state, content, frame);
    }
    const people = rosterOf(state, frame);
    showTeam(frame, content, people);
    showDanger(people, state.set.beat);
    const twins = twinVibesReading(state, set, tempo.ticksPerBar);
    showTwinVibes(twins);
    const player = shownPlayer(state, frame);
    setFlag(element, 'no-player', player === undefined);
    shownId = player?.id ?? null;
    showPotion(player === undefined ? null : potionReading(player, set, tempo.ticksPerBar));
    if (player !== undefined) {
      showPlayer(player, state, frame, content, set, tempo, twins);
    }
  }

  return {
    element,
    update,
    landing(playerId, weaponId) {
      if (element.dataset.multi !== undefined) {
        return bracelets.landing(playerId);
      }
      if (playerId !== shownId) {
        return null;
      }
      return gear.landing(weaponId) ?? level.element;
    },
    offerPlaces(playerId, places) {
      const shows = element.dataset.multi === undefined && playerId === shownId;
      gear.offer(shows ? places : null);
      return shows && places !== null ? gear.element : null;
    },
    tutorial,
    reset() {
      level.reset();
      vibes.reset();
      ribbonVibes.reset();
      banner.reset();
    },
  };
}
