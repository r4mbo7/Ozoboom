import type { ClassDefinition, GameContent, SetDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import { beatPeriodMs } from '../shared/tempo';
import { playedTempo, setOf, setTempo } from '../sim/lineup';
import type { PlayerId, PlayerState, SimState } from '../sim/state';
import { createBossBanner } from './boss-banner';
import { createBraceletRow } from './bracelet-row';
import { createDashTile } from './dash-tile';
import { el, icon, setFlag, setText, setVar } from './dom';
import { FULL_HUD } from './full';
import { createGaugeTile } from './gauge-tile';
import { createGearChips } from './gear-chips';
import { type Roster, allDown, classToken, inDanger, rosterOf } from './hud-model';
import { PAUSE } from './icons';
import { createLevelRing } from './level-ring';
import { createLineupRibbon } from './lineup-ribbon';
import type { Prompts } from './prompts';
import { createSkillTile } from './skill-tile';
import { createSpeakerPlugs } from './speaker-plugs';
import { cssName } from './sun';
import { createTrapHand } from './trap-hand';
import type { UiFrame } from './types';

export interface Hud {
  readonly element: HTMLElement;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  // A bracelet on a shared screen, else the circus weapon slot or the level ring; null for a player the HUD does not show.
  landing(playerId: PlayerId, weaponId: string | null): HTMLElement | null;
  reset(): void;
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
  ribbon.element.append(plugs.row, pauseButton());
  const level = createLevelRing();
  const gear = createGearChips();
  const hand = createTrapHand();
  const skill = createSkillTile(prompts);
  const dashTile = createDashTile();
  const gauge = createGaugeTile();
  const bar = el('div', 'ui-panel ui-hud__bar');
  const status = el('div', 'ui-panel ui-hud__status');
  status.append(level.element, gear.element);
  const actions = el('div', 'ui-panel ui-hud__actions');
  actions.append(hand.element, skill.element, dashTile.section, gauge.element);
  bar.append(status, actions);
  const bracelets = createBraceletRow(prompts);
  const top = el('div', 'ui-hud__top');
  top.append(ribbon.element, plugs.help);
  const banner = createBossBanner();
  const danger = el('div', 'ui-hud__danger');
  danger.setAttribute('aria-hidden', 'true');
  const watched = el('p', 'ui-hud__watched');
  watched.setAttribute('role', 'status');
  element.append(danger, watched, top, banner.element, bracelets.element, bar);
  const parts = Object.values(FULL_HUD).map((create) =>
    create({ ribbon: ribbon.element, overlay: element }),
  );

  let built: { content: GameContent; set: SetDefinition } | null = null;
  let dressed: { definition: ClassDefinition; device: InputDevice; keys: number } | null = null;
  let shownId: PlayerId | null = null;

  function build(content: GameContent, setId: string): SetDefinition {
    const set = setOf(content, setId);
    built = { content, set };
    setVar(element, '--beat', `${beatPeriodMs(setTempo(set).bpm).toFixed(1)}ms`);
    ribbon.build(set);
    plugs.build(set);
    hand.build(content, set);
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
    skill.build(definition.skill, device);
    setFlag(hand.element, 'gamepad', device === 'gamepad');
    setVar(element, '--who', `var(${cssName(classToken(definition.id))})`);
    gauge.build(definition.gauge);
  }

  function showTeam(frame: UiFrame, content: GameContent, people: Roster): void {
    setFlag(element, 'team', people.team);
    setFlag(element, 'multi', people.team && people.locals.length > 1);
    bracelets.update(frame, content, people);
    setFlag(element, 'danger', inDanger(people.locals));
    const down = allDown(people.locals);
    setFlag(element, 'watched', down);
    setText(watched, down ? t('Les lucioles veillent sur toi') : '');
  }

  function showPlayer(
    player: PlayerState,
    state: SimState,
    frame: UiFrame,
    content: GameContent,
    set: SetDefinition,
  ): void {
    const snapshot = frame.players[0]?.snapshot ?? frame.snapshot;
    const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
    if (definition !== null) {
      dress(definition, snapshot.device);
    }
    level.update(player);
    gear.update(player, state, content);
    hand.update(player, state, content, set, snapshot.gameplay);
    if (definition !== null) {
      skill.update(player, definition.skill);
      dashTile.update(player, content.dash, snapshot.device, state.tick, playedTempo(set, state));
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
    ribbon.update(set, state, content);
    plugs.update(set, state);
    banner.update(state, content);
    for (const part of parts) {
      part.update(state, content);
    }
    showTeam(frame, content, rosterOf(state, frame));
    const player = shownPlayer(state, frame);
    setFlag(element, 'no-player', player === undefined);
    shownId = player?.id ?? null;
    if (player !== undefined) {
      showPlayer(player, state, frame, content, set);
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
      // A short screen hides the gear: the card then lands on the level ring.
      return gear.landing(weaponId) ?? level.element;
    },
    reset() {
      hand.reset();
      level.reset();
      banner.reset();
    },
  };
}
