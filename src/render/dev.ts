import { TICK_MS } from '../shared/tempo';
import { applyModifiers } from '../sim/stats';
import { FIXTURE_CONTENT, type FixtureEvent, createFixtureState } from './fixture';
import { advanceFixture } from './fixture-step';
import { createRenderer } from './index';
import { PALETTE_TOKENS, paletteAt } from '../shared/palette';
import { SETS } from '../data/sets';
import type { SetDefinition } from '../data/types';
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
const hourInput = element('#hour') as HTMLInputElement;
const hourValue = element('#hour-value');

const state = createFixtureState({
  enemies: count('enemies', 300),
  projectiles: count('projectiles', 200),
  showcase: params.has('showcase'),
});
state.core.hp = (state.core.maxHp * count('coreHp', 100)) / 100;
const player = state.players[0];
if (player !== undefined && params.has('trapRadius')) {
  applyModifiers(player, [{ stat: 'trapRadiusMul', mul: count('trapRadius', 1) }]);
}
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

const renderer = await createRenderer(stage, { calmMode }, FIXTURE_CONTENT);
const population = `${String(state.enemies.length)} ennemis · ${String(state.projectiles.length)} projectiles`;
stats.textContent = population;

function setPressed(button: HTMLElement, pressed: boolean) {
  button.setAttribute('aria-pressed', String(pressed));
}

function setDowned(downed: boolean) {
  if (player !== undefined) {
    player.downed = downed;
  }
  setPressed(downedButton, downed);
}

setPressed(calmButton, calmMode);
setDowned(params.get('downed') === '1');

calmButton.addEventListener('click', () => {
  calmMode = !calmMode;
  renderer.setOptions({ calmMode });
  setPressed(calmButton, calmMode);
});
downedButton.addEventListener('click', () => {
  setDowned(player?.downed !== true);
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

if (frozenAt !== null) {
  stats.textContent = `Figé au tick ${String(frozenAt)} · ${population}`;
  const inject = (params.get('inject') ?? '').split(',').filter(Boolean) as FixtureEvent[];
  const injectAt = count('injectAt', frozenAt) - 1;
  while (state.tick < frozenAt) {
    advanceFixture(state, state.tick === injectAt ? inject : []);
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
      advanceFixture(state, queued);
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
