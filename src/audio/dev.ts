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
import { createAudioEngine, heardNow } from './index';

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
      return { type: 'enemyDied', id, kind: 'relou', x: 0, y: 0, byPlayer: 0 };
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

async function renderOffline(ending: 'won' | 'lost'): Promise<OfflineReport> {
  const totalTicks = 24 * TICKS_PER_BAR;
  const seconds = (totalTicks + TICKS_PER_BAR) * TICK_SECONDS;
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const kicks = new Map<number, number>();
  const engine = createAudioEngine({
    createContext: () => context,
    breakBars: () => BREAK_BARS,
    onKickScheduled: (tick, time) => kicks.set(tick, time),
  });
  await engine.start();
  const set = new FakeSet();
  const drift = emptyStats();
  for (let tick = 1; tick <= totalTicks; tick += 1) {
    void context.suspend(tick * TICK_SECONDS).then(() => {
      playScenario(set, tick, ending);
      set.step();
      engine.update(set.state);
      if (isBarTick(tick) && barOfTick(tick) >= MUTE_BAR) {
        engine.setMuted(barOfTick(tick) === MUTE_BAR);
      }
      queueMicrotask(() => {
        const kick = kicks.get(tick);
        if (isBeatTick(tick) && kick !== undefined) {
          record(drift, kick - context.currentTime);
        }
        void context.resume();
      });
    });
  }
  const buffer = await context.startRendering();
  engine.destroy();
  let peak = 0;
  let clipped = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    for (const sample of buffer.getChannelData(channel)) {
      const size = Math.abs(sample);
      peak = Math.max(peak, size);
      clipped += size >= 1 ? 1 : 0;
    }
  }
  const muteAt = MUTE_BAR * TICKS_PER_BAR * TICK_SECONDS;
  const bar = TICKS_PER_BAR * TICK_SECONDS;
  return {
    seconds,
    peak,
    clipped,
    beforeMute: peakOf(buffer, muteAt - bar, muteAt),
    afterMute: peakOf(buffer, muteAt + 0.02, muteAt + bar),
    drift,
  };
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

let last = performance.now();
let accumulator = 0;
function frame(time: number): void {
  accumulator += Math.max(0, time - last);
  last = time;
  let ticks = 0;
  while (accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
    accumulator -= TICK_MS;
    ticks += 1;
    stepOnce();
  }
  if (ticks === MAX_TICKS_PER_FRAME) {
    accumulator = 0;
  }
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
