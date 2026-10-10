import { TICK_MS } from '../shared/tempo';
import { applyModifiers } from '../sim/stats';
import { FIXTURE_CONTENT, createFixtureState } from './fixture';
import type { FixtureEvent } from './fixture-classes';
import { layCoop, reviveEvents } from './fixture-coop';
import { type SheetPose, killMasks, layMasks } from './fixture-sheet';
import { advanceSpecials, createSpecialsState } from './fixture-specials';
import { advanceFixture } from './fixture-step';
import {
  BASE_WEAPON_IDS,
  EVOLVED_WEAPON_IDS,
  giveWeapons,
  layWeaponSheet,
} from './fixture-weapons';
import { createRenderer } from './index';
import type { CameraFocus } from './types';
import { PALETTE_TOKENS, paletteAt } from '../shared/palette';
import { SETS } from '../data/sets';
import type { SetDefinition } from '../data/types';
import { type SpeakerPose, holdParty, layStacks } from './fixture-speakers';
import { pinFraction } from './fixture-time';

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`Missing element ${selector}`);
  }
  return found;
}

function paintPage(fraction: number) {
  const palette = paletteAt(fraction);
  for (const token of PALETTE_TOKENS) {
    const name = token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    document.documentElement.style.setProperty(`--${name}`, palette[token]);
  }
}

const params = new URLSearchParams(location.search);
const count = (name: string, fallback: number) => Number(params.get(name) ?? fallback);
const frozenAt = params.has('at') ? count('at', 0) : null;
const logFps = params.has('log');

const stage = element('#stage');
const stats = element('#stats');
const pointer = element('#pointer');
const calmButton = element('#calm');
const downedButton = element('#downed');
const invulnerableButton = element('#invulnerable');
const focusButton = element('#focus');
const hourInput = element('#hour') as HTMLInputElement;
const hourValue = element('#hour-value');

const specialsScene = params.get('scene') === 'specials';
const state = specialsScene
  ? createSpecialsState()
  : createFixtureState({
      enemies: count('enemies', 300),
      projectiles: count('projectiles', 200),
      showcase: params.has('showcase'),
    });
state.core.hp = (state.core.maxHp * count('coreHp', 100)) / 100;
const coop = params.has('coop');
if (coop) {
  layCoop(state);
}
const reviveProgress = params.has('revive') ? count('revive', 0) : null;
const sheet = params.has('sheet') ? count('sheet', 32) : null;
if (sheet !== null) {
  layMasks(state, sheet, (params.get('pose') ?? 'awake') as SheetPose);
}
if (params.has('speakers')) {
  layStacks(state, (params.get('speakers') ?? '').split(',') as SpeakerPose[]);
}
const [standX = state.core.x, standY = state.core.y] = (params.get('stand') ?? '')
  .split(',')
  .filter(Boolean)
  .map(Number);
const weaponParam = params.get('weapons') ?? '';
const weaponIds = /^\d+$/.test(weaponParam)
  ? BASE_WEAPON_IDS.slice(0, Number(weaponParam))
  : weaponParam.split(',').filter(Boolean);
giveWeapons(state, weaponIds);
const weaponSheet = params.has('weaponSheet') ? count('weaponSheet', 32) : null;
if (weaponSheet !== null) {
  layWeaponSheet(state, weaponSheet, params.has('evolved') ? EVOLVED_WEAPON_IDS : BASE_WEAPON_IDS);
}
const dieAt = params.has('dieAt') ? count('dieAt', 0) : null;
if (params.get('clean') === '1') {
  element('.panel').style.display = 'none';
}
if (params.get('bare') === '1') {
  state.traps = [];
  state.pickups = [];
}
const player = state.players[0];
if (player !== undefined && params.has('trapRadius')) {
  applyModifiers(player, [{ stat: 'trapRadiusMul', mul: count('trapRadius', 1) }]);
}
state.setId = params.get('set') ?? state.setId;
const found = SETS.find((candidate) => candidate.id === state.setId);
if (found === undefined) {
  throw new Error(`Missing set ${state.setId}`);
}
const set: SetDefinition = found;
let pinned: number | null = params.has('hour') ? count('hour', 0) : null;

function setHour(fraction: number) {
  pinned = fraction;
  hourInput.value = String(fraction);
  hourValue.textContent = fraction.toFixed(2).replace('.', ',');
  paintPage(fraction);
}

function pinHour() {
  if (pinned !== null) {
    pinFraction(state, set, pinned);
  }
}

if (pinned === null) {
  paintPage(0);
} else {
  setHour(pinned);
}
let calmMode = params.get('calm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
let queued: FixtureEvent[] = [];

let focus: CameraFocus =
  params.get('focus') === 'everyone' ? { kind: 'everyone' } : { kind: 'player', playerId: 0 };
await Promise.all(
  ['400 1em "Space Grotesk"', '700 1em "Space Grotesk"'].map((face) => document.fonts.load(face)),
);
const renderer = await createRenderer(stage, { calmMode, focus }, FIXTURE_CONTENT);
const population = `${String(state.enemies.length)} ennemis · ${String(state.projectiles.length)} projectiles`;
stats.textContent = population;

function setPressed(button: HTMLElement, pressed: boolean) {
  button.setAttribute('aria-pressed', String(pressed));
}

function setDowned(downed: boolean) {
  for (const member of state.players) {
    member.downed = downed;
  }
  setPressed(downedButton, downed);
}

function setInvulnerable(invulnerable: boolean) {
  for (const member of state.players) {
    member.invulnerableTicks = invulnerable ? Number.MAX_SAFE_INTEGER : 0;
  }
  setPressed(invulnerableButton, invulnerable);
}

setPressed(calmButton, calmMode);
if (!coop) {
  setDowned(params.get('downed') === '1');
}
setPressed(focusButton, focus.kind === 'everyone');
setInvulnerable(params.get('invulnerable') === '1');

calmButton.addEventListener('click', () => {
  calmMode = !calmMode;
  renderer.setOptions({ calmMode });
  setPressed(calmButton, calmMode);
});
downedButton.addEventListener('click', () => {
  setDowned(player?.downed !== true);
});
focusButton.addEventListener('click', () => {
  focus = focus.kind === 'everyone' ? { kind: 'player', playerId: 0 } : { kind: 'everyone' };
  renderer.setOptions({ focus });
  setPressed(focusButton, focus.kind === 'everyone');
});
invulnerableButton.addEventListener('click', () => {
  setInvulnerable(invulnerableButton.getAttribute('aria-pressed') !== 'true');
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-event]')) {
  button.addEventListener('click', () => {
    queued.push(button.dataset.event as FixtureEvent);
  });
}
hourInput.addEventListener('input', () => {
  setHour(Number(hourInput.value));
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-hour]')) {
  button.addEventListener('click', () => {
    setHour(Number(button.dataset.hour));
  });
}
window.addEventListener('resize', () => {
  renderer.resize(stage.clientWidth, stage.clientHeight);
});
stage.addEventListener('pointermove', (event) => {
  const world = renderer.screenToWorld({ x: event.offsetX, y: event.offsetY });
  pointer.textContent = `Pointeur : x ${world.x.toFixed(0)}, y ${world.y.toFixed(0)}`;
});

if (logFps) {
  const canvas = stage.querySelector('canvas');
  const probe = canvas?.getContext('webgl2') ?? null;
  const info = probe?.getExtension('WEBGL_debug_renderer_info');
  const other = ['webgl', 'webgpu', '2d'].find((type) => canvas?.getContext(type) != null);
  const gpu =
    probe === null
      ? `${other ?? 'unknown'} context`
      : String(probe.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? probe.RENDERER));
  console.info(`[render-bench] gpu=${gpu}`);
}

// A mask sheet stands still: the tick only runs, for the animations and the farewell.
function advance(events: readonly FixtureEvent[]) {
  if (specialsScene) {
    advanceSpecials(state);
    return;
  }
  if (coop) {
    state.tick += 1;
    state.events = reviveProgress === null ? [] : reviveEvents(reviveProgress);
    return;
  }
  if (sheet === null && weaponSheet === null) {
    advanceFixture(state, events);
    if (state.speakers !== undefined) {
      holdParty(state, standX, standY);
    }
    return;
  }
  state.tick += 1;
  state.events = [];
  if (state.tick === dieAt) {
    killMasks(state);
  }
}

if (frozenAt !== null) {
  stats.textContent = `Figé au tick ${String(frozenAt)} · ${population}`;
  const inject = (params.get('inject') ?? '').split(',').filter(Boolean) as FixtureEvent[];
  const injectAt = count('injectAt', frozenAt) - 1;
  while (state.tick < frozenAt) {
    advance(state.tick === injectAt ? inject : []);
    pinHour();
    renderer.render(state, 0);
  }
}

let previous = performance.now();
let accumulator = 0;
let frames = 0;
let renderMs = 0;
let windowStart = previous;

function frame(now: number) {
  accumulator += Math.min(now - previous, 250);
  previous = now;
  if (frozenAt === null) {
    while (accumulator >= TICK_MS) {
      advance(queued);
      queued = [];
      accumulator -= TICK_MS;
    }
  }
  const alpha = frozenAt === null ? accumulator / TICK_MS : 0.5;
  const started = performance.now();
  pinHour();
  renderer.render(state, alpha);
  renderMs += performance.now() - started;
  frames += 1;

  const elapsed = now - windowStart;
  if (frozenAt === null && elapsed >= 1000) {
    const fps = (frames * 1000) / elapsed;
    const cost = renderMs / frames;
    stats.textContent = `${fps.toFixed(0)} ips · rendu ${cost.toFixed(2)} ms · ${population}`;
    document.title = `fps=${fps.toFixed(1)} render=${cost.toFixed(2)}ms`;
    if (logFps) {
      console.info(`[render-bench] fps=${fps.toFixed(1)} renderMs=${cost.toFixed(3)}`);
    }
    frames = 0;
    renderMs = 0;
    windowStart = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
