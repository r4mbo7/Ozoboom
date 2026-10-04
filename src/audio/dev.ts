import '../style.css';
import {
  TICKS_PER_BAR,
  TICKS_PER_PHRASE,
  TICK_MS,
  barOfTick,
  beatOfTick,
  isBarTick,
  isBeatTick,
  isPhraseTick,
} from '../shared/tempo';
import type { GameStatus, SetSegment, SimEvent, SimState } from '../sim/state';
import { TICK_SECONDS } from './clock';
import { CROSSFADE_SECONDS, createFader } from './fade';
import { createAudioEngine, heardNow } from './index';
import type { AudioEngine, Mood } from './types';

const BREAK_BARS = 4;
const MAX_TICKS_PER_FRAME = 8;
const SAMPLE_RATE = 48_000;

type EventName =
  | 'playerFired'
  | 'enemyHit'
  | 'enemyDied'
  | 'coreHit'
  | 'trapShockwave'
  | 'trapBeam'
  | 'levelUp'
  | 'upgradeChosen'
  | 'skillUsed'
  | 'ultimateUsed'
  | 'gameWon'
  | 'gameLost';

const EVENT_LABELS: Readonly<Record<EventName, string>> = {
  playerFired: 'playerFired',
  enemyHit: 'enemyHit',
  enemyDied: 'enemyDied',
  coreHit: 'coreHit',
  trapShockwave: 'trapFired caisson',
  trapBeam: 'trapFired laser',
  levelUp: 'levelUp',
  upgradeChosen: 'upgradeChosen',
  skillUsed: 'skillUsed',
  ultimateUsed: 'ultimateUsed',
  gameWon: 'gameWon',
  gameLost: 'gameLost',
};

const EVENT_NAMES = Object.keys(EVENT_LABELS) as EventName[];

function eventOf(name: EventName, id: number): SimEvent {
  switch (name) {
    case 'playerFired':
      return { type: 'playerFired', playerId: 0, x: 0, y: 0, angle: 0 };
    case 'enemyHit':
      return { type: 'enemyHit', id, damage: 1, x: 0, y: 0 };
    case 'enemyDied':
      return { type: 'enemyDied', id, kind: 'desagreable', x: 0, y: 0, byPlayer: 0 };
    case 'coreHit':
      return { type: 'coreHit', damage: 5 };
    case 'trapShockwave':
      return { type: 'trapFired', id, kind: 'shockwave', x: 0, y: 0 };
    case 'trapBeam':
      return { type: 'trapFired', id, kind: 'beam', x: 0, y: 0 };
    case 'levelUp':
      return { type: 'levelUp', playerId: 0, level: 2 };
    case 'upgradeChosen':
      return { type: 'upgradeChosen', playerId: 0, upgradeId: 'dev' };
    case 'skillUsed':
      return { type: 'skillUsed', playerId: 0 };
    case 'ultimateUsed':
      return { type: 'ultimateUsed', playerId: 0 };
    case 'gameWon':
      return { type: 'gameWon' };
    case 'gameLost':
      return { type: 'gameLost' };
  }
}

function createFixture(): SimState {
  return {
    seed: 1,
    setId: 'soiree-v0',
    tick: 0,
    status: 'running',
    rng: { a: 1, b: 2, c: 3, d: 4 },
    arena: { width: 1600, height: 1000 },
    set: { tier: 0, segment: 'buildup', phrase: 0, bar: 0, beat: 0, segmentStartTick: 0 },
    core: { x: 800, y: 500, radius: 48, hp: 1000, maxHp: 1000, watts: 0 },
    players: [],
    enemies: [],
    projectiles: [],
    traps: [],
    pickups: [],
    pendingUpgrades: [],
    nextEntityId: 1,
    stats: { kills: 0, phrasesHeld: 0, damageDealt: 0, vibesCollected: 0, wattsSpent: 0 },
    events: [],
  };
}

class FakeSet {
  readonly state = createFixture();
  private readonly queued: SimEvent[] = [];
  private nextId = 1;
  entering: SetSegment | null = null;

  queue(name: EventName, count = 1): void {
    for (let index = 0; index < count; index += 1) {
      this.queued.push(eventOf(name, this.nextId));
      this.nextId += 1;
    }
  }

  enter(segment: SetSegment): void {
    this.entering = segment;
  }

  step(): void {
    const { state } = this;
    state.events.length = 0;
    if (state.status === 'running') {
      state.tick += 1;
      this.keepTime();
    }
    if (this.entering !== null && (isBarTick(state.tick) || state.status !== 'running')) {
      state.set.segment = this.entering;
      state.set.segmentStartTick = state.tick;
      state.events.push({ type: 'segment', segment: this.entering, tier: state.set.tier });
      this.entering = null;
    }
    state.events.push(...this.queued);
    this.queued.length = 0;
  }

  private keepTime(): void {
    const { tick, set, events } = this.state;
    if (isBeatTick(tick)) {
      set.beat = beatOfTick(tick);
      events.push({ type: 'beat', beat: set.beat });
    }
    if (isBarTick(tick)) {
      set.bar = barOfTick(tick);
      events.push({ type: 'bar', bar: set.bar });
      if (set.segment === 'break' && tick - set.segmentStartTick >= BREAK_BARS * TICKS_PER_BAR) {
        this.entering = 'drop';
      }
    }
    if (isPhraseTick(tick)) {
      set.phrase += 1;
      events.push({ type: 'phrase', phrase: set.phrase });
    }
  }
}

interface DriftStats {
  count: number;
  sum: number;
  worst: number;
  last: number;
  over: number;
}

function emptyStats(): DriftStats {
  return { count: 0, sum: 0, worst: 0, last: 0, over: 0 };
}

function record(stats: DriftStats, offset: number): void {
  stats.count += 1;
  stats.sum += offset;
  stats.last = offset;
  stats.worst = Math.max(stats.worst, Math.abs(offset));
  stats.over += Math.abs(offset) >= 0.02 ? 1 : 0;
}

function ms(seconds: number): string {
  return `${(seconds * 1000).toFixed(1)} ms`;
}

interface OfflineReport {
  seconds: number;
  peak: number;
  clipped: number;
  beforeMute: number;
  afterMute: number;
  drift: DriftStats;
}

const MUTE_BAR = 22;
const BAR_SECONDS = TICKS_PER_BAR * TICK_SECONDS;
const REFERENCE_BARS = 36;
const REFERENCE_SECONDS = 60;
const REFERENCE_BREAK_BAR = 12;
const REFERENCE_WINDOWS: readonly (readonly [label: string, fromBar: number, untilBar: number])[] =
  [
    ['montée, mesures 8 à 12', 8, 12],
    ['break, mesures 12 à 16', 12, 16],
    ['drop, mesures 20 à 24', 20, 24],
  ];
const BANDS: readonly (readonly [label: string, low: number | null, high: number | null])[] = [
  ['grave, sous 150 Hz', null, 150],
  ['bas médium, 150 Hz à 1 kHz', 150, 1000],
  ['haut médium, 1 à 5 kHz', 1000, 5000],
  ['aigu, au-dessus de 5 kHz', 5000, null],
  ['tout le spectre', null, null],
];

function peakOf(buffer: AudioBuffer, from: number, until: number): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (
      let index = Math.floor(from * buffer.sampleRate);
      index < until * buffer.sampleRate;
      index += 1
    ) {
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    }
  }
  return peak;
}

function playScenario(set: FakeSet, tick: number, ending: 'won' | 'lost'): void {
  const { state } = set;
  if (isBarTick(tick)) {
    const bar = barOfTick(tick);
    if (bar === 2 || bar === 4 || bar === 6) {
      state.set.phrase += 1;
    } else if (bar === 8) {
      set.enter('break');
    } else if (bar === 16) {
      state.set.tier = 1;
      state.set.phrase = 4;
      set.enter('buildup');
    } else if (bar === 20) {
      state.status = ending;
      set.queue(ending === 'won' ? 'gameWon' : 'gameLost');
    }
    if (bar >= 12 && bar < 20) {
      set.queue('coreHit');
    }
    if (bar === 13 || bar === 18) {
      set.queue('enemyDied', 50);
      for (const name of EVENT_NAMES) {
        set.queue(name);
      }
    }
  }
  const bar = barOfTick(tick);
  if (bar >= 12 && bar < 20 && isBeatTick(tick)) {
    set.queue('playerFired');
    set.queue('enemyHit', 5);
    set.queue('trapShockwave');
    set.queue('trapBeam');
  }
}

function playReference(set: FakeSet, tick: number): void {
  if (!isBarTick(tick)) {
    return;
  }
  const bar = barOfTick(tick);
  if (bar === 3 || bar === 6 || bar === 9) {
    set.state.set.phrase += 1;
  } else if (bar === REFERENCE_BREAK_BAR) {
    set.enter('break');
  }
}

interface Rendered {
  buffer: AudioBuffer;
  drift: DriftStats;
}

// Steps the offline audio clock one tick at a time. `onTick` returns the sim tick it stepped, or
// null when the sim stood still, so the drift is only measured on ticks the music followed.
async function drive(
  seconds: number,
  ticks: number,
  onTick: (tick: number, engine: AudioEngine) => number | null,
  mood: Mood = 'set',
): Promise<Rendered> {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const kicks = new Map<number, number>();
  const pumps = new Set<() => void>();
  const engine = createAudioEngine({
    createContext: () => context,
    breakBars: () => BREAK_BARS,
    onKickScheduled: (tick, time) => kicks.set(tick, time),
    repeat: (callback) => {
      pumps.add(callback);
      return () => {
        pumps.delete(callback);
      };
    },
  });
  engine.setMood(mood);
  await engine.start();
  const drift = emptyStats();
  for (let tick = 1; tick <= ticks; tick += 1) {
    void context.suspend(tick * TICK_SECONDS).then(() => {
      const stepped = onTick(tick, engine);
      for (const pump of [...pumps]) {
        pump();
      }
      queueMicrotask(() => {
        const kick = stepped === null ? undefined : kicks.get(stepped);
        if (stepped !== null && isBeatTick(stepped) && kick !== undefined) {
          record(drift, kick - context.currentTime);
        }
        void context.resume();
      });
    });
  }
  const buffer = await context.startRendering();
  engine.destroy();
  return { buffer, drift };
}

function render(
  bars: number,
  seconds: number,
  script: (set: FakeSet, tick: number) => void,
  muteBar: number | null,
): Promise<Rendered> {
  const set = new FakeSet();
  return drive(seconds, bars * TICKS_PER_BAR, (tick, engine) => {
    script(set, tick);
    set.step();
    engine.update(set.state);
    if (muteBar !== null && isBarTick(tick) && barOfTick(tick) >= muteBar) {
      engine.setMuted(barOfTick(tick) === muteBar);
    }
    return tick;
  });
}

function clippingOf(buffer: AudioBuffer): { peak: number; clipped: number } {
  let peak = 0;
  let clipped = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    for (const sample of buffer.getChannelData(channel)) {
      const size = Math.abs(sample);
      peak = Math.max(peak, size);
      clipped += size >= 1 ? 1 : 0;
    }
  }
  return { peak, clipped };
}

async function renderOffline(ending: 'won' | 'lost'): Promise<OfflineReport> {
  const seconds = 25 * BAR_SECONDS;
  const { buffer, drift } = await render(
    24,
    seconds,
    (set, tick) => {
      playScenario(set, tick, ending);
    },
    MUTE_BAR,
  );
  const muteAt = MUTE_BAR * BAR_SECONDS;
  return {
    seconds,
    ...clippingOf(buffer),
    beforeMute: peakOf(buffer, muteAt - BAR_SECONDS, muteAt),
    afterMute: peakOf(buffer, muteAt + 0.02, muteAt + BAR_SECONDS),
    drift,
  };
}

async function bandLevels(buffer: AudioBuffer): Promise<number[][]> {
  const levels: number[][] = [];
  for (const [, low, high] of BANDS) {
    const context = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    let node: AudioNode = source;
    for (const [type, hz] of [
      ['highpass', low],
      ['highpass', low],
      ['lowpass', high],
      ['lowpass', high],
    ] as const) {
      if (hz !== null) {
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = hz;
        node.connect(filter);
        node = filter;
      }
    }
    node.connect(context.destination);
    source.start();
    const samples = (await context.startRendering()).getChannelData(0);
    levels.push(
      REFERENCE_WINDOWS.map(([, fromBar, untilBar]) => {
        const from = Math.floor(fromBar * BAR_SECONDS * buffer.sampleRate);
        const until = Math.floor(untilBar * BAR_SECONDS * buffer.sampleRate);
        let sum = 0;
        for (let index = from; index < until; index += 1) {
          sum += (samples[index] ?? 0) ** 2;
        }
        return 10 * Math.log10(sum / (until - from) + 1e-12);
      }),
    );
  }
  return levels;
}

function wavOf(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const bytes = buffer.length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (const samples of data) {
      const sample = Math.max(-1, Math.min(1, samples[frame] ?? 0));
      view.setInt16(offset, Math.round(sample * 0x7fff), true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

interface ReferenceReport {
  peak: number;
  clipped: number;
  drift: DriftStats;
  levels: number[][];
  wav: Blob;
}

async function renderReference(): Promise<ReferenceReport> {
  const { buffer, drift } = await render(REFERENCE_BARS, REFERENCE_SECONDS, playReference, null);
  return {
    ...clippingOf(buffer),
    drift,
    levels: await bandLevels(buffer),
    wav: wavOf(buffer),
  };
}

function dbOf(value: number): string {
  return `${(20 * Math.log10(value)).toFixed(1)} dB`;
}

function rmsOf(samples: Float32Array, from: number, until: number, rate: number): number {
  const first = Math.max(0, Math.floor(from * rate));
  const last = Math.min(samples.length, Math.floor(until * rate));
  let sum = 0;
  for (let index = first; index < last; index += 1) {
    sum += (samples[index] ?? 0) ** 2;
  }
  return Math.sqrt(sum / Math.max(1, last - first));
}

function stereoRms(buffer: AudioBuffer, from: number, until: number): number {
  const left = rmsOf(buffer.getChannelData(0), from, until, buffer.sampleRate);
  const right = rmsOf(buffer.getChannelData(1), from, until, buffer.sampleRate);
  return Math.sqrt((left ** 2 + right ** 2) / 2);
}

async function lowBand(buffer: AudioBuffer, hz: number): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  let node: AudioNode = source;
  for (let pass = 0; pass < 2; pass += 1) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = hz;
    node.connect(filter);
    node = filter;
  }
  node.connect(context.destination);
  source.start();
  return (await context.startRendering()).getChannelData(0);
}

const AMBIENCE_SECONDS = 30;

function ticksIn(seconds: number): number {
  return Math.ceil(seconds / TICK_SECONDS) - 1;
}

interface AmbienceReport {
  peak: number;
  clipped: number;
  rms: number;
  wav: Blob;
}

async function renderAmbience(): Promise<AmbienceReport> {
  const { buffer } = await drive(AMBIENCE_SECONDS, ticksIn(AMBIENCE_SECONDS), () => null, 'menu');
  return {
    ...clippingOf(buffer),
    rms: stereoRms(buffer, 0, AMBIENCE_SECONDS),
    wav: wavOf(buffer),
  };
}

const PAUSE_BAR = 8;
const MENU_MUTE_BAR = 12;
const RESUME_BAR = 16;
const END_BAR = 24;
const SUNRISE_SECONDS = 16;
const MOODS_SECONDS = END_BAR * BAR_SECONDS + SUNRISE_SECONDS + 3 * BAR_SECONDS;
const SUB_HZ = 50;

interface MoodsReport {
  peak: number;
  clipped: number;
  drift: DriftStats;
  setRms: number;
  menuRms: number;
  beforeMute: number;
  afterMute: number;
  pauseCurve: number[];
  resumeCurve: number[];
  endCurve: number[];
  wav: Blob;
}

// Level per beat of the band under 50 Hz, where the kick and the bass of the set live, in dB
// against the last bar of the set before the pause.
function beatCurve(
  sub: Float32Array,
  rate: number,
  reference: number,
  at: number,
  beats: number,
): number[] {
  const beat = BAR_SECONDS / 4;
  return Array.from({ length: beats }, (_, index) => {
    const from = at + index * beat;
    return 20 * Math.log10(rmsOf(sub, from, from + beat, rate) / reference);
  });
}

async function renderMoods(): Promise<MoodsReport> {
  const set = new FakeSet();
  let paused = false;
  const { buffer, drift } = await drive(MOODS_SECONDS, ticksIn(MOODS_SECONDS), (tick, engine) => {
    const bar = barOfTick(tick);
    if (isBarTick(tick)) {
      if (bar === 2 || bar === 4) {
        set.state.set.phrase += 1;
      } else if (bar === PAUSE_BAR) {
        paused = true;
        engine.setMood('menu');
      } else if (bar === MENU_MUTE_BAR || bar === MENU_MUTE_BAR + 1) {
        engine.setMuted(bar === MENU_MUTE_BAR);
      } else if (bar === RESUME_BAR) {
        paused = false;
        engine.setMood('set');
      } else if (bar === END_BAR) {
        set.state.status = 'won';
        set.queue('gameWon');
      }
    }
    if (paused) {
      return null;
    }
    set.step();
    engine.update(set.state);
    if (set.state.status !== 'running') {
      engine.setMood('menu');
      return null;
    }
    return set.state.tick;
  });
  const sub = await lowBand(buffer, SUB_HZ);
  const rate = buffer.sampleRate;
  const setSub = rmsOf(sub, (PAUSE_BAR - 1) * BAR_SECONDS, PAUSE_BAR * BAR_SECONDS, rate);
  const muteAt = MENU_MUTE_BAR * BAR_SECONDS;
  const allBand = buffer.getChannelData(0);
  const endAt = END_BAR * BAR_SECONDS + SUNRISE_SECONDS;
  return {
    ...clippingOf(buffer),
    drift,
    setRms: stereoRms(buffer, PAUSE_BAR * BAR_SECONDS - 4 * BAR_SECONDS, PAUSE_BAR * BAR_SECONDS),
    menuRms: stereoRms(buffer, (PAUSE_BAR + 2) * BAR_SECONDS, muteAt),
    beforeMute: peakOf(buffer, muteAt - BAR_SECONDS, muteAt),
    afterMute: peakOf(buffer, muteAt + 0.02, muteAt + BAR_SECONDS),
    pauseCurve: beatCurve(sub, rate, setSub, PAUSE_BAR * BAR_SECONDS, 8),
    resumeCurve: beatCurve(sub, rate, setSub, RESUME_BAR * BAR_SECONDS - BAR_SECONDS, 12),
    endCurve: Array.from({ length: 12 }, (_, index) => {
      const from = endAt - 1 + index * 0.5;
      return 20 * Math.log10(rmsOf(allBand, from, from + 0.5, rate));
    }),
    wav: wavOf(buffer),
  };
}

interface FadeReport {
  seconds: number;
  shapeError: number;
  powerError: number;
  turnJump: number;
  turnSeconds: number;
}

// Renders the gains of two real faders, one leaving and one entering, then one turning back.
async function measureFades(): Promise<FadeReport> {
  const seconds = 7;
  const context = new OfflineAudioContext(2, seconds * SAMPLE_RATE, SAMPLE_RATE);
  const merger = context.createChannelMerger(2);
  merger.connect(context.destination);
  const [leaving, entering] = [1, 0].map((presence, channel) => {
    const source = context.createConstantSource();
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(merger, 0, channel);
    source.start();
    return createFader(gain.gain, context, presence);
  });
  if (leaving === undefined || entering === undefined) {
    throw new Error('Missing fader');
  }
  const later = (time: number, action: () => void) => {
    void context.suspend(time).then(() => {
      action();
      void context.resume();
    });
  };
  later(0.5, () => {
    leaving.to(0);
    entering.to(1);
  });
  later(4, () => entering.to(0));
  later(4 + CROSSFADE_SECONDS / 4, () => entering.to(1));
  const buffer = await context.startRendering();
  const out = buffer.getChannelData(0);
  const into = buffer.getChannelData(1);
  const rate = buffer.sampleRate;
  const start = out.findIndex((gain) => gain < 1 - 1e-6);
  const end = out.findIndex((gain) => gain <= 1e-6);
  let shapeError = 0;
  let powerError = 0;
  for (let index = start; index < end; index += 1) {
    const progress = (index - start) / (end - start);
    shapeError = Math.max(
      shapeError,
      Math.abs((out[index] ?? 0) - Math.cos((progress * Math.PI) / 2)),
    );
    powerError = Math.max(
      powerError,
      Math.abs((out[index] ?? 0) ** 2 + (into[index] ?? 0) ** 2 - 1),
    );
  }
  let turnJump = 0;
  const turnFrom = Math.floor(3.9 * rate);
  for (let index = turnFrom; index < Math.floor(6.5 * rate); index += 1) {
    turnJump = Math.max(turnJump, Math.abs((into[index] ?? 0) - (into[index - 1] ?? 0)));
  }
  const leaves = into.findIndex((gain, index) => index > turnFrom && gain < 1 - 1e-6);
  const back = into.findIndex((gain, index) => index > leaves && gain >= 1 - 1e-6);
  return {
    seconds: (end - start) / rate,
    shapeError,
    powerError,
    turnJump,
    turnSeconds: (back - leaves) / rate,
  };
}

function downloadLink(name: string, wav: Blob): void {
  const link = output(name);
  if (link instanceof HTMLAnchorElement) {
    URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(wav);
    link.hidden = false;
  }
}

function curveText(curve: readonly number[]): string {
  return curve.map((value) => value.toFixed(1)).join(' ');
}

const SEGMENTS: readonly SetSegment[] = ['buildup', 'break', 'drop'];
const STATUSES: readonly GameStatus[] = ['running', 'choosingUpgrade', 'won', 'lost'];
const PHRASES = [0, 1, 2, 3, 4];
const TIERS = [0, 1, 2];

function buttons(group: string, values: readonly (string | number)[]): string {
  return values
    .map(
      (value) =>
        `<button type="button" data-${group}="${String(value)}" aria-pressed="false">${String(value)}</button>`,
    )
    .join('');
}

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('Missing #app root element');
}

root.innerHTML = `
  <style>
    body { display: block; padding: 1.5rem; }
    .bench { max-width: 64rem; margin: 0 auto; display: grid; gap: 1rem; }
    .bench h1 { margin: 0; color: var(--uv-magenta); letter-spacing: 0.06em; font-size: 1.6rem; }
    .bench h1 span { color: var(--glow); font-weight: 400; }
    .bench p { margin: 0.25rem 0 0; color: var(--uv-cyan); }
    .bench section { background: var(--ink); border-radius: 0.75rem; padding: 1rem; }
    .bench h2 { margin: 0 0 0.75rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--uv-cyan); }
    .bench .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1rem; }
    .bench dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0; }
    .bench dt { color: color-mix(in srgb, var(--glow) 62%, var(--ink)); }
    .bench dd { margin: 0; font-variant-numeric: tabular-nums; }
    .bench .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
    .bench .row:last-child { margin-bottom: 0; }
    .bench .label { min-width: 5.5rem; color: color-mix(in srgb, var(--glow) 62%, var(--ink)); }
    .bench button { font: inherit; color: var(--glow); background: var(--night); border: 1px solid var(--bad-vibe); border-radius: 0.5rem; padding: 0.35rem 0.7rem; cursor: pointer; }
    .bench button:hover { border-color: var(--uv-cyan); }
    .bench button[aria-pressed='true'] { border-color: var(--uv-magenta); color: var(--uv-magenta); box-shadow: 0 0 0.6em var(--uv-magenta); }
    .bench button.primary { border-color: var(--uv-lime); color: var(--uv-lime); }
    .bench a { color: var(--uv-cyan); }
    .bench .bands { overflow-x: auto; margin-top: 0.75rem; }
    .bench table { border-spacing: 1rem 0.25rem; font-variant-numeric: tabular-nums; }
    .bench th { text-align: left; font-weight: 400; color: color-mix(in srgb, var(--glow) 62%, var(--ink)); }
    .bench .beat { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 50%; background: var(--bad-vibe); vertical-align: middle; }
    .bench .beat.on { background: var(--uv-cyan); box-shadow: 0 0 0.8em var(--uv-cyan); }
  </style>
  <div class="bench">
    <header>
      <h1>Ozoboom <span>banc audio</span></h1>
      <p>Horloge de ticks factice à 29 Hz, tout le son est synthétisé.</p>
    </header>
    <section>
      <div class="row">
        <button type="button" class="primary" data-action="start">Démarrer le son</button>
        <button type="button" data-action="mute" aria-pressed="false">Couper le son</button>
        <span class="beat" data-beat></span>
        <span data-out="engine">Son arrêté : rien ne joue avant le démarrage.</span>
      </div>
    </section>
    <div class="columns">
      <section>
        <h2>Horloge</h2>
        <dl>
          <dt>Tick</dt><dd data-out="tick"></dd>
          <dt>Temps</dt><dd data-out="beat"></dd>
          <dt>Mesure</dt><dd data-out="bar"></dd>
          <dt>Phrase</dt><dd data-out="phrase"></dd>
          <dt>Palier</dt><dd data-out="tier"></dd>
          <dt>Segment</dt><dd data-out="segment"></dd>
          <dt>Statut</dt><dd data-out="status"></dd>
        </dl>
      </section>
      <section>
        <h2>Dérive en direct</h2>
        <dl>
          <dt>Temps mesurés</dt><dd data-out="count"></dd>
          <dt>Écart moyen</dt><dd data-out="mean"></dd>
          <dt>Écart max</dt><dd data-out="worst"></dd>
          <dt>Dernier écart</dt><dd data-out="last"></dd>
          <dt>Écarts ≥ 20 ms</dt><dd data-out="over"></dd>
        </dl>
        <div class="row" style="margin-top: 0.75rem">
          <button type="button" data-action="reset">Remettre à zéro</button>
        </div>
      </section>
    </div>
    <section>
      <h2>Set</h2>
      <div class="row"><span class="label">Segment</span>${buttons('segment', SEGMENTS)}</div>
      <div class="row"><span class="label">Phrase</span>${buttons('phrase', PHRASES)}</div>
      <div class="row"><span class="label">Palier</span>${buttons('tier', TIERS)}</div>
      <div class="row"><span class="label">Statut</span>${buttons('status', STATUSES)}</div>
      <div class="row">
        <span class="label">Menus</span>
        <button type="button" data-action="pause" aria-pressed="false">Pause</button>
        <span data-out="mood"></span>
      </div>
    </section>
    <section>
      <h2>Événements</h2>
      <div class="row">
        ${EVENT_NAMES.map((name) => `<button type="button" data-event="${name}">${EVENT_LABELS[name]}</button>`).join('')}
        <button type="button" data-event="enemyDied" data-count="50">50 × enemyDied</button>
      </div>
    </section>
    <section>
      <h2>Rendu hors ligne</h2>
      <p style="color: var(--glow); margin-bottom: 0.75rem">
        24 mesures : montée en couches, break, drop avec tous les effets et 50 morts dans la même image, deuxième palier (1), fin de partie, son coupé à la mesure 22 et rendu à la 23.
      </p>
      <div class="row">
        <button type="button" data-offline="won">Rendre la victoire</button>
        <button type="button" data-offline="lost">Rendre la défaite</button>
      </div>
      <dl>
        <dt>Rendu</dt><dd data-out="offline">pas encore lancé</dd>
        <dt>Crête</dt><dd data-out="peak">-</dd>
        <dt>Échantillons écrêtés</dt><dd data-out="clipped">-</dd>
        <dt>Coupure du son</dt><dd data-out="mute">-</dd>
        <dt>Écart kick et tick</dt><dd data-out="offlineDrift">-</dd>
      </dl>
    </section>
    <section>
      <h2>Rendu de référence, 60 secondes</h2>
      <p style="color: var(--glow); margin-bottom: 0.75rem">
        Musique seule : montée en couches de 12 mesures, break de 4 mesures, drop de 20 mesures. Niveau efficace par bande, en dBFS.
      </p>
      <div class="row">
        <button type="button" data-reference>Rendre 60 s</button>
        <a data-out="download" download="ozoboom-reference-60s.wav" hidden>Télécharger le WAV</a>
      </div>
      <dl>
        <dt>Rendu</dt><dd data-out="reference">pas encore lancé</dd>
        <dt>Crête</dt><dd data-out="referencePeak">-</dd>
        <dt>Écart kick et tick</dt><dd data-out="referenceDrift">-</dd>
      </dl>
      <div class="bands"><table data-out="bands"></table></div>
    </section>
    <section>
      <h2>Ambiance menu, 30 secondes</h2>
      <p style="color: var(--glow); margin-bottom: 0.75rem">
        L'ambiance seule, telle qu'elle entre en pause ou sur l'écran de fin.
      </p>
      <div class="row">
        <button type="button" data-ambience>Rendre 30 s</button>
        <a data-out="ambienceDownload" download="ozoboom-ambiance-menu-30s.wav" hidden>Télécharger le WAV</a>
      </div>
      <dl>
        <dt>Rendu</dt><dd data-out="ambience">pas encore lancé</dd>
        <dt>Crête</dt><dd data-out="ambiencePeak">-</dd>
        <dt>Niveau efficace</dt><dd data-out="ambienceRms">-</dd>
      </dl>
    </section>
    <section>
      <h2>Fondus enchaînés</h2>
      <p style="color: var(--glow); margin-bottom: 0.75rem">
        Set 8 mesures, pause (ambiance) 8 mesures avec le son coupé à la mesure 12 et rendu à la 13, reprise, victoire à la mesure 24, puis sunrise et ambiance. Les courbes donnent, temps par temps, le niveau sous 50 Hz (kick et basse du set) par rapport à la dernière mesure du set avant la pause, et la fin le niveau de tout le spectre par demi-seconde autour de la fin du sunrise.
      </p>
      <div class="row">
        <button type="button" data-moods>Rendre les fondus</button>
        <a data-out="moodsDownload" download="ozoboom-fondus.wav" hidden>Télécharger le WAV</a>
      </div>
      <dl>
        <dt>Rendu</dt><dd data-out="moods">pas encore lancé</dd>
        <dt>Crête</dt><dd data-out="moodsPeak">-</dd>
        <dt>Set puis ambiance</dt><dd data-out="moodsLevels">-</dd>
        <dt>Coupure en pause</dt><dd data-out="moodsMute">-</dd>
        <dt>Pause, set</dt><dd data-out="pauseCurve">-</dd>
        <dt>Reprise, set</dt><dd data-out="resumeCurve">-</dd>
        <dt>Fin, par 0,5 s</dt><dd data-out="endCurve">-</dd>
        <dt>Écart kick et tick</dt><dd data-out="moodsDrift">-</dd>
      </dl>
      <div class="row" style="margin-top: 0.75rem">
        <button type="button" data-fades>Mesurer les fondus</button>
      </div>
      <dl>
        <dt>Durée d'un fondu</dt><dd data-out="fadeSeconds">-</dd>
        <dt>Forme</dt><dd data-out="fadeShape">-</dd>
        <dt>Puissance</dt><dd data-out="fadePower">-</dd>
        <dt>Demi-tour</dt><dd data-out="fadeTurn">-</dd>
      </dl>
    </section>
  </div>
`;

function output(name: string): HTMLElement {
  const element = root?.querySelector<HTMLElement>(`[data-out="${name}"]`);
  if (element === null || element === undefined) {
    throw new Error(`Missing output ${name}`);
  }
  return element;
}

function show(name: string, text: string): void {
  output(name).textContent = text;
}

const fake = new FakeSet();
let context: AudioContext | null = null;
let muted = false;
let paused = false;
let drift = emptyStats();
const kicks = new Map<number, number>();
const arrivals = new Map<number, number>();

const engine = createAudioEngine({
  breakBars: () => BREAK_BARS,
  createContext: () => {
    context = new AudioContext();
    return context;
  },
  onKickScheduled: (tick, time) => {
    kicks.set(tick, time);
    settle(tick);
  },
});

function settle(tick: number): void {
  const kick = kicks.get(tick);
  const arrival = arrivals.get(tick);
  if (kick !== undefined && arrival !== undefined) {
    record(drift, kick - arrival);
    kicks.delete(tick);
    arrivals.delete(tick);
  }
}

function forget(before: number): void {
  for (const map of [kicks, arrivals]) {
    for (const tick of map.keys()) {
      if (tick < before) {
        map.delete(tick);
      }
    }
  }
}

function stepOnce(): void {
  fake.step();
  engine.update(fake.state);
  const { tick } = fake.state;
  const now = context === null ? null : heardNow(context);
  if (now !== null && fake.state.events.some((event) => event.type === 'beat')) {
    arrivals.set(tick, now);
    queueMicrotask(() => {
      settle(tick);
    });
  }
  if (isBarTick(tick)) {
    forget(tick - TICKS_PER_BAR);
  }
}

function moodOf(): Mood {
  return paused || fake.state.status === 'won' || fake.state.status === 'lost' ? 'menu' : 'set';
}

function refresh(): void {
  const { state } = fake;
  const { set } = state;
  show('tick', String(state.tick));
  show('beat', `${String(set.beat)} (${String((set.beat % 4) + 1)} sur 4)`);
  show('bar', String(set.bar));
  show(
    'phrase',
    `${String(set.phrase)} (prochaine dans ${String(TICKS_PER_PHRASE - (state.tick % TICKS_PER_PHRASE))} ticks)`,
  );
  show('tier', String(set.tier));
  const barsIn = Math.floor((state.tick - set.segmentStartTick) / TICKS_PER_BAR);
  const detail =
    fake.entering !== null
      ? `, ${fake.entering} à la prochaine mesure`
      : set.segment === 'break'
        ? `, drop dans ${String(BREAK_BARS - barsIn)} mesures`
        : '';
  show('segment', `${set.segment}${detail}`);
  show('status', state.status);
  show('mood', `ambiance ${moodOf()}`);
  show('count', String(drift.count));
  show('mean', drift.count > 0 ? ms(drift.sum / drift.count) : '-');
  show('worst', drift.count > 0 ? ms(drift.worst) : '-');
  show('last', drift.count > 0 ? ms(drift.last) : '-');
  show('over', String(drift.over));
  const pressed: [string, string][] = [
    ['segment', set.segment],
    ['phrase', String(set.phrase)],
    ['tier', String(set.tier)],
    ['status', state.status],
  ];
  for (const [group, value] of pressed) {
    for (const button of root?.querySelectorAll<HTMLButtonElement>(`[data-${group}]`) ?? []) {
      button.setAttribute('aria-pressed', String(button.dataset[group] === value));
    }
  }
  root
    ?.querySelector('[data-beat]')
    ?.classList.toggle('on', state.tick % 12 < 3 && state.status === 'running');
}

function dbfs(value: number): string {
  return value.toFixed(1);
}

function showReference(report: ReferenceReport): void {
  show('reference', `${String(REFERENCE_SECONDS)} s, ${String(REFERENCE_BARS)} mesures`);
  show(
    'referencePeak',
    `${report.peak.toFixed(3)} (${(20 * Math.log10(report.peak)).toFixed(2)} dBFS), ${String(report.clipped)} échantillons écrêtés`,
  );
  show(
    'referenceDrift',
    `${String(report.drift.count)} temps, moyen ${ms(report.drift.sum / report.drift.count)}, max ${ms(report.drift.worst)}`,
  );
  const link = output('download');
  if (link instanceof HTMLAnchorElement) {
    URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(report.wav);
    link.hidden = false;
  }
  const head = `<tr><th>Bande</th>${REFERENCE_WINDOWS.map(([label]) => `<th>${label}</th>`).join('')}<th>drop moins break</th></tr>`;
  const rows = BANDS.map(([label], band) => {
    const levels = report.levels[band] ?? [];
    const gap = (levels[2] ?? 0) - (levels[1] ?? 0);
    return `<tr data-band="${String(band)}"><td>${label}</td>${levels.map((level) => `<td>${dbfs(level)}</td>`).join('')}<td>${gap >= 0 ? '+' : ''}${dbfs(gap)} dB</td></tr>`;
  });
  output('bands').innerHTML = head + rows.join('');
}

let last = performance.now();
let accumulator = 0;
function frame(time: number): void {
  accumulator += Math.max(0, time - last);
  last = time;
  let ticks = 0;
  while (accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
    accumulator -= TICK_MS;
    ticks += 1;
    if (!paused) {
      stepOnce();
    }
  }
  if (ticks === MAX_TICKS_PER_FRAME) {
    accumulator = 0;
  }
  engine.setMood(moodOf());
  refresh();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

root.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const { action, segment, phrase, tier, status, offline } = target.dataset;
  const { state } = fake;
  if (action === 'start') {
    void engine.start().then(() => {
      show('engine', 'Son démarré.');
    });
    target.disabled = true;
  } else if (action === 'mute') {
    muted = !muted;
    engine.setMuted(muted);
    target.setAttribute('aria-pressed', String(muted));
    target.textContent = muted ? 'Remettre le son' : 'Couper le son';
  } else if (action === 'pause') {
    paused = !paused;
    target.setAttribute('aria-pressed', String(paused));
  } else if (action === 'reset') {
    drift = emptyStats();
  } else if (segment !== undefined) {
    fake.enter(segment as SetSegment);
  } else if (phrase !== undefined) {
    state.set.phrase = Number(phrase);
  } else if (tier !== undefined) {
    state.set.tier = Number(tier);
  } else if (status !== undefined) {
    state.status = status as GameStatus;
  } else if (target.dataset.event !== undefined) {
    fake.queue(target.dataset.event as EventName, Number(target.dataset.count ?? 1));
  } else if (target.dataset.ambience !== undefined) {
    show('ambience', 'rendu en cours...');
    void renderAmbience().then((report) => {
      show('ambience', `${String(AMBIENCE_SECONDS)} s`);
      show(
        'ambiencePeak',
        `${report.peak.toFixed(3)} (${dbOf(report.peak)}FS), ${String(report.clipped)} échantillons écrêtés`,
      );
      show('ambienceRms', `${dbOf(report.rms)}FS`);
      downloadLink('ambienceDownload', report.wav);
    });
  } else if (target.dataset.moods !== undefined) {
    show('moods', 'rendu en cours...');
    void renderMoods().then((report) => {
      show('moods', `${MOODS_SECONDS.toFixed(1)} s`);
      show(
        'moodsPeak',
        `${report.peak.toFixed(3)} (${dbOf(report.peak)}FS), ${String(report.clipped)} échantillons écrêtés`,
      );
      show('moodsLevels', `${dbOf(report.setRms)}FS puis ${dbOf(report.menuRms)}FS`);
      show(
        'moodsMute',
        `crête ${report.beforeMute.toFixed(4)} la mesure d'avant, ${report.afterMute.toFixed(5)} de 20 ms à 1 mesure après`,
      );
      show('pauseCurve', curveText(report.pauseCurve));
      show('resumeCurve', curveText(report.resumeCurve));
      show('endCurve', curveText(report.endCurve));
      show(
        'moodsDrift',
        `${String(report.drift.count)} temps, moyen ${ms(report.drift.sum / report.drift.count)}, max ${ms(report.drift.worst)}`,
      );
      downloadLink('moodsDownload', report.wav);
    });
  } else if (target.dataset.fades !== undefined) {
    void measureFades().then((report) => {
      show('fadeSeconds', `${report.seconds.toFixed(3)} s`);
      show('fadeShape', `écart max au quart de sinus ${report.shapeError.toExponential(1)}`);
      show(
        'fadePower',
        `écart max de la somme des puissances à 1 : ${report.powerError.toExponential(1)}`,
      );
      show(
        'fadeTurn',
        `saut max ${report.turnJump.toExponential(1)} par échantillon, aller-retour en ${report.turnSeconds.toFixed(3)} s`,
      );
    });
  } else if (target.dataset.reference !== undefined) {
    show('reference', 'rendu en cours...');
    void renderReference().then(showReference);
  } else if (offline === 'won' || offline === 'lost') {
    show('offline', 'rendu en cours...');
    void renderOffline(offline).then((report) => {
      show(
        'offline',
        `${report.seconds.toFixed(1)} s, ${offline === 'won' ? 'victoire' : 'défaite'}`,
      );
      show('peak', `${report.peak.toFixed(3)} (${(20 * Math.log10(report.peak)).toFixed(2)} dBFS)`);
      show('clipped', String(report.clipped));
      show(
        'mute',
        `crête ${report.beforeMute.toFixed(4)} la mesure d'avant, ${report.afterMute.toFixed(5)} de 20 ms à 1 mesure après`,
      );
      show(
        'offlineDrift',
        `${String(report.drift.count)} temps, moyen ${ms(report.drift.sum / report.drift.count)}, max ${ms(report.drift.worst)}`,
      );
    });
  }
});
