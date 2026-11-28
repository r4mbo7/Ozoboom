import type { InputDevice, MenuIntents } from '../input/intents';
import { el, fillHint, icon, setText } from './dom';
import { formatNumber } from './format';
import {
  createActionButton,
  createControlsButton,
  createFeedbackButton,
  createSoundMixButton,
} from './feedback-button';
import { openDiscord } from './discord';
import { DISCORD, DOOR, GEAR, GLOBE, PROGRAMME } from './icons';
import { type Menu, createMenu } from './menu';
import type { Prompts } from './prompts';
import type { MenuHeard } from '../shared/menu-score';
import { TITLE_AT_REST, type TitleLight, heardFrom, titleLightOf } from './title-light';
import {
  createAutoAimToggle,
  createAutoFireToggle,
  createHitSoundToggle,
  createToggle,
} from './toggle';
import {
  SOUND_BUSES,
  type SoundBus,
  type SoundMix,
  createBusControls,
  createSoundControl,
} from './volume';
import { createPseudoSetting, editPseudo } from './pseudo-field';
import { createLanguageControl, createLanguageList } from './language';
import { locale, t, tn, type Locale } from '../shared/i18n';
import { createCredits } from './credits';
import { createThanksClock, thanksOf } from './title-thanks';
import { createThanksPainter } from './title-thanks-paint';
import { FULL_CHANGELOG, FULL_LEADERBOARD } from './full';
import type { Leaderboard } from './types';

export interface TitleActions {
  start(): void;
  playOnline(): void;
  programme(): void;
  toggleCalmMode(): void;
  toggleMute(): void;
  stepVolume(side: -1 | 1): void;
  toggleMix(bus: SoundBus): void;
  stepMix(bus: SoundBus, side: -1 | 1): void;
  toggleHitSound(): void;
  toggleAutoFire(): void;
  toggleAutoAim(): void;
  setPseudo(pseudo: string): void;
  controls(): void;
  chooseLocale(locale: Locale): void;
  feedback?(): void;
  changelogOpened(): void;
  // Absent, the title has no Classement entry: the build reads no board.
  leaderboardOpened?(): void;
  // Absent, the title has no Quit entry: a browser closes its own tab.
  quitApp?(): void;
}

export interface TitleOptions {
  readonly calmMode: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly mix: SoundMix;
  readonly hitSound: boolean;
  readonly autoFire: boolean;
  readonly autoAim: boolean;
  readonly pseudo: string;
}

export type TitleView = 'main' | 'settings' | 'sound' | 'credits' | 'changelog' | 'leaderboard';

const parentOf = (view: TitleView): TitleView => (view === 'sound' ? 'settings' : 'main');

// The notebook of what changed, which only the full game has: its rows are menu items, one open at a time.
export interface ChangelogView {
  readonly element: HTMLElement;
  readonly rows: readonly HTMLElement[];
  open(row: HTMLElement): void;
}

// The Classement screen, which only the full game has: its rows are menu items, walked to read them.
export interface LeaderboardView {
  // Its heading, and the title's entry that opens it.
  readonly title: string;
  readonly entry: HTMLButtonElement;
  readonly element: HTMLElement;
  // The rows of the tab shown, best first.
  readonly rows: readonly HTMLElement[];
  // The player's best run in that tab, null without one.
  readonly mine: HTMLElement | null;
  // On today's tab; the title walks its rows.
  open(): void;
  set(board: Leaderboard): void;
  // True when the presses turned the tab.
  handle(edges: MenuIntents): boolean;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  handle(edges: MenuIntents): void;
  // Back to the three entries, or straight into one of them.
  open(view: TitleView): void;
  setOptions(options: TitleOptions): void;
  setDevice(device: InputDevice): void;
  setVisits(count: number): void;
  setChangelogNews(news: boolean): void;
  setLeaderboard(board: Leaderboard): void;
  // What the menus play as it is heard, null when nothing; calm or null stills the title.
  follow(heard: MenuHeard | null, calm: boolean): void;
}

// The scene is drawn in hundredths of the title's em, so the sun keeps its size against the logo.
const CENTRE = 1000;
const HORIZON = 1000;
const DISC = 220;
const RAYS = 11;
const RAY_FADE = 2.8;
const REFLECTIONS = [
  { depth: 10, reach: 211 },
  { depth: 21, reach: 174 },
  { depth: 33, reach: 134 },
  { depth: 46, reach: 95 },
  { depth: 60, reach: 57 },
];

function point(radius: number, turn: number): string {
  const x = CENTRE + radius * Math.cos(turn);
  const y = HORIZON - radius * Math.sin(turn);
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

// The stars are the same on every load.
function scatter(count: number, seed: number): [number, number][] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => [next(), next()]);
}

const STARS = scatter(46, 7)
  .map(([x, y]) => {
    const height = 20 + y ** 1.4 * 760;
    const size = 1.2 + 1.6 * ((x * 7.3) % 1);
    return `<circle cx="${(x * 2000).toFixed(0)}" cy="${height.toFixed(0)}" r="${size.toFixed(1)}"/>`;
  })
  .join('');

// The moon is drawn in hundredths of its radius: a crescent in profile, looking right towards the
// sun, her lid heavy; ui.css sets her course down into the lake.
const MOON_RIM =
  'M42 -91C20 -82 8 -68 10 -50C11 -42 19 -40 17 -33C15 -27 15 -24 19 -18C27 -10 40 -6 43 -2' +
  'C44 2 33 5 25 4C27 8 34 10 33 15L24 19C33 21 34 26 29 30C24 33 19 34 20 39C21 46 30 49 33 55' +
  'C36 64 48 74 62 78A100 100 0 1 1 42 -91Z';

const MOON =
  '<div class="ui-title__moonlit"><svg class="ui-title__moon" ' +
  'viewBox="-300 -300 600 600" aria-hidden="true" focusable="false"><defs>' +
  '<radialGradient id="ui-title-moon-halo"><stop class="ui-title__moon-glow" offset="0"/>' +
  '<stop class="ui-title__moon-glow" offset="1" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="ui-title-moon-gold"><stop class="ui-title__gold" offset="0"/>' +
  '<stop class="ui-title__gold" offset="1" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="ui-title-moon-fill" cx="-20" cy="0" r="105" fx="-35" fy="-20" fr="10" ' +
  'gradientUnits="userSpaceOnUse"><stop class="ui-title__moon-light" offset="0"/>' +
  '<stop class="ui-title__moon-shade" offset="1"/></radialGradient>' +
  '<radialGradient id="ui-title-moon-blush"><stop class="ui-title__moon-blush" offset="0" stop-opacity="0.3"/>' +
  '<stop class="ui-title__moon-blush" offset="1" stop-opacity="0"/></radialGradient>' +
  `<path id="ui-title-moon-rim" d="${MOON_RIM}"/>` +
  '<clipPath id="ui-title-moon-face"><use href="#ui-title-moon-rim"/></clipPath>' +
  '<clipPath id="ui-title-moon-eye"><path d="M-25 -27Q-8 -40 9 -27Q-8 -19 -25 -27Z"/></clipPath>' +
  '</defs>' +
  '<circle class="ui-title__moon-halo" r="280" fill="url(#ui-title-moon-halo)"/>' +
  '<circle class="ui-title__moon-aura" cx="-30" r="140" fill="url(#ui-title-moon-gold)"/>' +
  '<use href="#ui-title-moon-rim" fill="url(#ui-title-moon-fill)"/>' +
  '<use class="ui-title__moon-dawn" href="#ui-title-moon-rim"/>' +
  '<g clip-path="url(#ui-title-moon-face)">' +
  '<circle cx="-2" cy="8" r="32" fill="url(#ui-title-moon-blush)"/>' +
  '<circle class="ui-title__moon-lips" cx="27" cy="20" r="12" fill="url(#ui-title-moon-blush)"/></g>' +
  '<g class="ui-title__moon-face">' +
  '<g class="ui-title__moon-open"><g clip-path="url(#ui-title-moon-eye)">' +
  '<circle cx="2" cy="-27" r="6.5"/>' +
  '<path d="M-30 -47H14V-27Q-8 -32.1 -30 -27Z" fill="url(#ui-title-moon-fill)" stroke="none"/></g>' +
  '<path class="ui-title__moon-lid" d="M-25 -27Q-8 -32.1 9 -27"/></g>' +
  '<path class="ui-title__moon-lid ui-title__moon-shut" d="M-25 -27Q-8 -20 9 -27"/>' +
  '<path d="M-22 -25.8Q-8 -19.5 7 -26.5" stroke-width="2.4" opacity="0.75"/>' +
  '<path d="M-23 -34Q-8 -43 8 -33" stroke-width="2.6" opacity="0.55"/>' +
  '<path d="M-30 -40C-20 -52 2 -52 13 -43"/>' +
  '<path d="M27 -5Q31 0 36 -1M24 19Q17 20 13 17" stroke-width="3.2"/></g>' +
  '<use class="ui-title__moon-rim" href="#ui-title-moon-rim"/></svg></div>';

// Her reflection, broken twice like the sun's, centred under the lit side of the crescent.
const MOON_RIPPLES = [
  { depth: 25, reach: 92 },
  { depth: 51, reach: 73 },
  { depth: 77, reach: 54 },
  { depth: 103, reach: 35 },
];

const MOON_GLINT =
  '<div class="ui-title__moonlake"><svg class="ui-title__moon-glint" viewBox="-230 0 390 160" ' +
  'aria-hidden="true" focusable="false"><circle cx="0" cy="31" r="120" ' +
  'fill="url(#ui-title-moon-halo)" stroke="none" opacity="0.15"/><g class="ui-title__moon-ripples">' +
  MOON_RIPPLES.map(({ depth, reach }, index) => {
    const [gap, inner] = [reach * 0.32, reach * 0.18];
    const x = (offset: number) => (offset - 35).toFixed(0);
    return (
      `<path opacity="${(0.75 - index * 0.12).toFixed(2)}" d="M${x(-reach)} ${String(depth)}` +
      `H${x(-gap)}M${x(-inner)} ${String(depth)}H${x(inner)}M${x(gap)} ${String(depth)}H${x(reach)}"/>`
    );
  }).join('') +
  '</g></svg></div>';

// The glow stays low, not veiled behind the title: a veil would cut it into a band.
const NIGHT =
  '<svg class="ui-title__night ui-title__veiled" viewBox="0 0 2000 1000" ' +
  'preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
  `<g class="ui-title__stars">${STARS}</g></svg>`;

const GLOW =
  '<svg class="ui-title__sun" viewBox="0 0 2000 1000" aria-hidden="true" focusable="false"><defs>' +
  '<radialGradient id="ui-title-glow"><stop class="ui-title__gold" offset="0" stop-opacity="0.3"/>' +
  '<stop class="ui-title__gold" offset="0.4" stop-opacity="0.08"/>' +
  '<stop class="ui-title__gold" offset="1" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="ui-title-dawn"><stop class="ui-title__ember" offset="0" stop-opacity="0.4"/>' +
  '<stop class="ui-title__ember" offset="1" stop-opacity="0"/></radialGradient></defs>' +
  `<ellipse class="ui-title__sun-glow" cx="${String(CENTRE)}" cy="${String(HORIZON)}" rx="1000" ` +
  'ry="190" fill="url(#ui-title-glow)"/>' +
  `<ellipse class="ui-title__sun-dawn" cx="${String(CENTRE)}" cy="${String(HORIZON)}" rx="520" ` +
  'ry="100" fill="url(#ui-title-dawn)"/></svg>';

const SUN =
  '<svg class="ui-title__sun ui-title__veiled" viewBox="0 0 2000 1000" aria-hidden="true" ' +
  'focusable="false"><defs>' +
  `<radialGradient id="ui-title-rays" cx="${String(CENTRE)}" cy="${String(HORIZON)}" ` +
  `r="${String(DISC * RAY_FADE)}" gradientUnits="userSpaceOnUse">` +
  `<stop class="ui-title__gold" offset="${(1 / RAY_FADE).toFixed(3)}"/>` +
  '<stop class="ui-title__gold" offset="1" stop-opacity="0"/></radialGradient>' +
  `<linearGradient id="ui-title-disc" x1="0" x2="0" y1="${String(HORIZON - DISC)}" ` +
  `y2="${String(HORIZON + DISC)}" gradientUnits="userSpaceOnUse">` +
  '<stop class="ui-title__disc-stop" offset="0" style="--a: 0.12"/>' +
  '<stop class="ui-title__disc-stop" offset="0.275" style="--a: 0.2"/>' +
  '<stop class="ui-title__disc-stop ui-title__ember" offset="0.5" style="--a: 0.62"/>' +
  '<stop class="ui-title__disc-stop ui-title__ember" offset="1" style="--a: 0.62"/>' +
  '</linearGradient>' +
  '</defs><path class="ui-title__sun-rays" stroke="url(#ui-title-rays)" d="' +
  Array.from({ length: RAYS }, (_, index) => {
    const turn = ((index + 1) * Math.PI) / (RAYS + 1);
    const reach = DISC * (index % 2 === 0 ? 2.7 : 1.8);
    return `M${point(DISC + 16, turn)}L${point(reach, turn)}`;
  }).join('') +
  '"/>' +
  // A whole disc: the title shows its top half over the horizon, the credits see it rise.
  `<circle class="ui-title__sun-disc" fill="url(#ui-title-disc)" cx="${String(CENTRE)}" ` +
  `cy="${String(HORIZON)}" r="${String(DISC)}"/>` +
  `<circle class="ui-title__sun-ring" cx="${String(CENTRE)}" cy="${String(HORIZON)}" ` +
  `r="${String(DISC + 9)}"/></svg>`;

const WATER =
  '<svg class="ui-title__lake" viewBox="0 0 2000 300" aria-hidden="true" focusable="false"><defs>' +
  `<radialGradient id="ui-title-column" cx="${String(CENTRE)}" cy="0" r="420" ` +
  'gradientTransform="matrix(1 0 0 0.38 0 0)" gradientUnits="userSpaceOnUse">' +
  '<stop class="ui-title__ember" offset="0" stop-opacity="0.34"/>' +
  '<stop class="ui-title__ember" offset="1" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="ui-title-horizon" x1="0" x2="2000" gradientUnits="userSpaceOnUse">' +
  '<stop class="ui-title__gold" offset="0.15" stop-opacity="0"/>' +
  '<stop class="ui-title__gold" offset="0.38"/><stop class="ui-title__gold" offset="0.62"/>' +
  '<stop class="ui-title__gold" offset="0.85" stop-opacity="0"/></linearGradient></defs>' +
  '<rect class="ui-title__lake-column" width="2000" height="300" fill="url(#ui-title-column)"/>' +
  '<path class="ui-title__horizon" stroke="url(#ui-title-horizon)" d="M0 1.5H2000"/>' +
  '<g class="ui-title__reflections">' +
  REFLECTIONS.map(({ depth, reach }, note) => {
    // Each reflection breaks twice, as light does on ripples.
    const [outer, gap, inner] = [reach, reach * 0.3, reach * 0.22];
    const x = (offset: number) => (CENTRE + offset).toFixed(0);
    const y = String(depth);
    return (
      `<path style="--lit: var(--r${String(note)})" d="M${x(-outer)} ${y}H${x(-gap)}` +
      `M${x(-inner)} ${y}H${x(inner)}M${x(gap)} ${y}H${x(outer)}"/>`
    );
  }).join('') +
  '</g></svg>';

// In the full game, the release number opens the notebook of what changed.
function door(release: string, label: string): HTMLButtonElement {
  const button = el('button', 'ui-title__meta ui-title__version', release);
  button.type = 'button';
  button.setAttribute('aria-label', `${release}, ${label}`);
  return button;
}

export function createTitle(prompts: Prompts, actions: TitleActions): TitleScreen {
  const element = el('section', 'ui-screen ui-title');
  element.setAttribute('aria-label', t('Title screen'));

  const sky = el('div', 'ui-title__sky');
  sky.innerHTML = NIGHT + MOON + GLOW + SUN;
  const water = el('div', 'ui-title__water');
  water.innerHTML = WATER + MOON_GLINT;
  const lake = el('canvas', 'ui-title__thanks');
  lake.setAttribute('aria-hidden', 'true');
  water.append(lake);

  const header = el('header', 'ui-title__header');
  const mark = el('div', 'ui-title__mark');
  const logo = el('h1', 'ui-title__logo', 'Ozoboom');
  logo.dataset.text = 'Ozoboom';
  mark.append(logo);
  header.append(mark, el('p', 'ui-title__tagline', t('Defend the sound system until sunrise.')));
  const heading = el('h2', 'ui-title__view');

  const shown = new Map<string, string>();
  const show = (light: TitleLight) => {
    const values: [string, number][] = [
      ['--swell', light.swell],
      ['--sheen', light.sheen],
      ...light.reflections.map((lit, note): [string, number] => [`--r${String(note)}`, lit]),
    ];
    for (const [name, value] of values) {
      const text = value.toFixed(2);
      if (shown.get(name) !== text) {
        shown.set(name, text);
        element.style.setProperty(name, text);
      }
    }
  };
  show(TITLE_AT_REST);
  let origin: number | null = null;

  const play = el('button', 'ui-button ui-button--primary', t('Play'));
  play.type = 'button';
  const online = createActionButton(t('Online'), t('With friends, over the internet'), GLOBE);
  const programme = createActionButton(
    t('The Programme'),
    t('Bad vibes, bosses and the whole line-up'),
    PROGRAMME,
  );
  programme.classList.add('ui-title__programme');
  const settings = createActionButton(t('Settings'), t('Calm mode, controls, language'), GEAR);
  settings.classList.add('ui-title__settings');
  // In the desktop app, Quit shares the Settings' row: the column keeps its height.
  const quit = actions.quitApp === undefined ? null : createActionButton(t('Quit'), '', DOOR);
  let settingsRow: HTMLElement = settings;
  if (quit !== null) {
    settingsRow = el('div', 'ui-title__pair');
    settingsRow.append(settings, quit);
  }

  const calm = createToggle(
    t('Calm mode'),
    t('No strobes, shakes or strong glows'),
    t('On'),
    t('Off'),
  );
  const stepVolume = (side: -1 | 1) => {
    actions.stepVolume(side);
  };
  const sound = createSoundControl(stepVolume);
  const mixSound = createSoundControl(stepVolume);
  const stepBus = (bus: SoundBus, side: -1 | 1) => {
    actions.stepMix(bus, side);
  };
  const buses = createBusControls(stepBus);
  const soundMix = createSoundMixButton();
  soundMix.classList.add('ui-title__sound-mix');
  const backRow = () => {
    const back = el('button', 'ui-button ui-title__back', t('Back'));
    back.type = 'button';
    return back;
  };
  const soundBack = backRow();
  const hitSound = createHitSoundToggle();
  const autoFire = createAutoFireToggle();
  const autoAim = createAutoAimToggle();
  const pseudo = createPseudoSetting((typed) => {
    actions.setPseudo(typed);
  });
  const keys = createControlsButton();
  const language = createLanguageControl(locale());
  const feedback = actions.feedback === undefined ? null : createFeedbackButton();

  const settingsBack = backRow();

  const credits = createCredits();
  const creditsButton = el('button', 'ui-title__credits', t('Credits'));
  creditsButton.type = 'button';
  // The pill bottom left that leaves a page of its own.
  const backButton = () => {
    const back = el('button', 'ui-button ui-title__credits-back');
    back.type = 'button';
    back.append(icon('ui-title__credits-chevron', '<path d="M15 5l-7 7 7 7"/>'), t('Back'));
    return back;
  };
  const creditsBack = backButton();

  const changelog = FULL_CHANGELOG.create?.() ?? null;
  const release = `v${__APP_RELEASE__}`;
  const whatsNew = t("What's new");
  const version = changelog === null ? el('p', 'ui-title__meta', release) : door(release, whatsNew);
  const changelogBack = backButton();

  const leaderboard =
    actions.leaderboardOpened === undefined
      ? null
      : (FULL_LEADERBOARD.create?.(walkLeaderboard) ?? null);
  // Where the view put the selection when it opened, until its board arrives; -1 after.
  let placed = -1;
  // With a Classement, the Programme shares its row with it: the column keeps its height.
  const leaderboardButton = leaderboard?.entry ?? null;
  const leaderboardEntry = leaderboardButton === null ? [] : [leaderboardButton];
  let programmeRow: HTMLElement = programme;
  if (leaderboardButton !== null) {
    programmeRow = el('div', 'ui-title__pair');
    programmeRow.append(programme, leaderboardButton);
  }
  const leaderboardBack = backButton();

  const discord = el('button', 'ui-title__discord');
  discord.type = 'button';
  discord.setAttribute('aria-label', t('Backstage'));
  discord.title = t('Come backstage on Discord');
  discord.append(icon('ui-title__discord-icon', DISCORD));

  const views: Record<TitleView, { title: string; items: HTMLElement[]; nav: HTMLElement }> = {
    main: {
      title: '',
      items: [
        play,
        online,
        programme,
        ...leaderboardEntry,
        sound.element,
        settings,
        ...(quit === null ? [] : [quit]),
        discord,
        creditsButton,
        ...(changelog === null ? [] : [version]),
      ],
      nav: el('nav', 'ui-menu'),
    },
    leaderboard: {
      title: leaderboard?.title ?? '',
      items: [leaderboardBack],
      nav: leaderboard?.element ?? el('nav', 'ui-menu'),
    },
    changelog: {
      title: whatsNew,
      items: [...(changelog?.rows ?? []), changelogBack],
      nav: changelog?.element ?? el('nav', 'ui-menu'),
    },
    credits: {
      title: t('Credits'),
      items: [creditsBack, credits.link],
      nav: el('nav', 'ui-menu'),
    },
    settings: {
      title: t('Settings'),
      items: [
        calm.button,
        hitSound.button,
        autoFire.button,
        autoAim.button,
        keys,
        pseudo.row,
        language,
        ...(feedback === null ? [] : [feedback]),
        soundMix,
        settingsBack,
      ],
      nav: el('nav', 'ui-menu ui-menu--settings'),
    },
    sound: {
      title: t('Sound mix'),
      items: [mixSound.element, ...SOUND_BUSES.map((bus) => buses[bus].element), soundBack],
      nav: el('nav', 'ui-menu'),
    },
  };
  views.main.nav.setAttribute('aria-label', t('Main menu'));
  views.main.nav.append(play, online, programmeRow, sound.element, settingsRow);
  for (const name of ['settings', 'sound', 'credits', 'changelog', 'leaderboard'] as const) {
    views[name].nav.setAttribute('aria-label', views[name].title);
  }
  views.settings.nav.append(...views.settings.items);
  views.sound.nav.append(...views.sound.items);
  views.credits.nav.append(creditsBack);
  views.changelog.nav.append(changelogBack);
  views.leaderboard.nav.append(leaderboardBack);

  const hint = el('p', 'ui-hint');
  const deck = el('div', 'ui-title__deck');
  deck.append(
    views.main.nav,
    views.settings.nav,
    views.sound.nav,
    views.credits.nav,
    views.changelog.nav,
    views.leaderboard.nav,
  );

  const visits = el('p', 'ui-title__visits');
  visits.hidden = true;
  const corner = el('div', 'ui-title__corner');
  corner.append(creditsButton, version, visits);

  const body = el('div', 'ui-title__body');
  body.append(sky, water, credits.element, header, heading, deck, hint, corner, discord);
  const languages = createLanguageList(
    prompts,
    locale(),
    (next) => {
      actions.chooseLocale(next);
    },
    () => {
      menu.select(views.settings.items.indexOf(language));
    },
  );
  element.append(body, languages.element);

  const activations = new Map<HTMLElement, () => void>([
    [
      play,
      () => {
        actions.start();
      },
    ],
    [
      settings,
      () => {
        open('settings');
      },
    ],
    [discord, openDiscord],
    [
      creditsButton,
      () => {
        open('credits');
      },
    ],
    [
      online,
      () => {
        actions.playOnline();
      },
    ],
    [
      programme,
      () => {
        actions.programme();
      },
    ],
    [
      calm.button,
      () => {
        actions.toggleCalmMode();
      },
    ],
    [
      sound.element,
      () => {
        actions.toggleMute();
      },
    ],
    [
      hitSound.button,
      () => {
        actions.toggleHitSound();
      },
    ],
    [
      autoFire.button,
      () => {
        actions.toggleAutoFire();
      },
    ],
    [
      autoAim.button,
      () => {
        actions.toggleAutoAim();
      },
    ],
    [
      keys,
      () => {
        actions.controls();
      },
    ],
    [
      pseudo.row,
      () => {
        editPseudo(pseudo.input);
      },
    ],
    [
      language,
      () => {
        languages.open();
      },
    ],
  ]);
  if (feedback !== null) {
    activations.set(feedback, () => {
      actions.feedback?.();
    });
  }
  if (quit !== null) {
    activations.set(quit, () => {
      actions.quitApp?.();
    });
  }
  activations.set(creditsBack, () => {
    open('main');
  });
  activations.set(credits.link, () => {
    window.open(credits.link.href, '_blank', 'noopener');
  });
  activations.set(settingsBack, () => {
    open('main');
  });
  activations.set(soundMix, () => {
    open('sound');
  });
  activations.set(mixSound.element, () => {
    actions.toggleMute();
  });
  for (const bus of SOUND_BUSES) {
    activations.set(buses[bus].element, () => {
      actions.toggleMix(bus);
    });
  }
  activations.set(soundBack, () => {
    open('settings');
  });
  activations.set(version, () => {
    open('changelog');
  });
  activations.set(changelogBack, () => {
    open('main');
  });
  if (leaderboardButton !== null) {
    activations.set(leaderboardButton, () => {
      open('leaderboard');
    });
  }
  activations.set(leaderboardBack, () => {
    open('main');
  });
  if (changelog !== null) {
    for (const row of changelog.rows) {
      activations.set(row, () => {
        changelog.open(row);
      });
    }
  }

  // Back on the title, the selection is the entry the player left it by.
  const openers: Partial<Record<TitleView, HTMLElement>> = {
    settings,
    sound: soundMix,
    credits: creditsButton,
    changelog: version,
    ...(leaderboardButton === null ? {} : { leaderboard: leaderboardButton }),
  };
  const steppers = new Map<HTMLElement, (side: -1 | 1) => void>([
    [sound.element, stepVolume],
    [mixSound.element, stepVolume],
    ...SOUND_BUSES.map((bus): [HTMLElement, (side: -1 | 1) => void] => [
      buses[bus].element,
      (side) => {
        stepBus(bus, side);
      },
    ]),
  ]);
  let view: TitleView = 'main';
  const menu = createMenu(
    (index) => {
      const item = views[view].items[index];
      if (item !== undefined) {
        activations.get(item)?.();
      }
    },
    (index, side) => {
      const item = views[view].items[index];
      const step = item === undefined ? undefined : steppers.get(item);
      step?.(side);
      return step !== undefined;
    },
  );

  function open(next: TitleView): void {
    const from = view;
    view = next;
    body.dataset.view = next;
    header.hidden = next !== 'main';
    heading.hidden = next === 'main' || next === 'credits';
    discord.hidden = next !== 'main';
    corner.hidden = next === 'credits' || next === 'changelog' || next === 'leaderboard';
    creditsButton.hidden = next !== 'main';
    hint.hidden = next === 'credits';
    if (next === 'changelog' && from !== 'changelog') {
      version.removeAttribute('data-news');
      actions.changelogOpened();
    }
    if (next === 'leaderboard' && from !== 'leaderboard') {
      leaderboard?.open();
      actions.leaderboardOpened?.();
    }
    credits.element.hidden = next !== 'credits';
    setText(heading, views[next].title);
    for (const [name, { nav }] of Object.entries(views)) {
      nav.hidden = name !== next;
    }
    menu.setItems(views[next].items);
    const opener = openers[from] ?? null;
    if (next === parentOf(from) && opener !== null) {
      menu.select(views[next].items.indexOf(opener));
    }
    if (next === 'leaderboard') {
      walkLeaderboard(true);
    }
    if (next === 'credits') {
      body.style.setProperty('--credits-roll', `${credits.open().toFixed(1)}s`);
    }
    showHint();
  }

  let device: InputDevice | null = null;
  let keysShown = -1;
  let calmNow = false;
  const thanks = createThanksClock(thanksOf());
  const painter = createThanksPainter(lake, views.main.nav);

  // A new tab goes to the player's run, or the best one, and so does the board the view opened on
  // while the player has not moved; once they have, a board read again keeps their row, or Back.
  function walkLeaderboard(turned: boolean): void {
    if (view !== 'leaderboard' || leaderboard === null) {
      return;
    }
    const before = views.leaderboard.items;
    const items = [...leaderboard.rows, leaderboardBack];
    views.leaderboard.items = items;
    if (turned || menu.index === placed) {
      const mine = leaderboard.mine;
      menu.setItems(items, mine === null ? 0 : items.indexOf(mine));
      mine?.scrollIntoView({ block: 'nearest' });
      placed = turned ? menu.index : -1;
      return;
    }
    const onBack = before[menu.index] === leaderboardBack;
    menu.setItems(items, onBack ? items.length - 1 : Math.min(menu.index, items.length - 2));
  }

  function showHint(): void {
    if (device === null) {
      return;
    }
    const shown = prompts.for(device);
    // The Classement has nothing to confirm: its keys turn the tabs, none on a touch screen.
    const action =
      view === 'leaderboard'
        ? { keys: shown.tabs, label: t('tabs') }
        : { keys: [shown.confirm], label: view === 'changelog' ? t('open') : t('confirm') };
    fillHint(
      hint,
      [
        { keys: shown.navigate, label: t('navigate') },
        ...(view === 'main' ? [{ keys: shown.navigateRow, label: t('sound') }] : []),
        ...(view === 'sound' ? [{ keys: shown.navigateRow, label: t('level') }] : []),
        ...(action.keys.length === 0 ? [] : [action]),
        ...(view === 'main' ? [] : [{ keys: [shown.back], label: t('back') }]),
      ],
      shown.style,
    );
  }

  open('main');

  return {
    element,
    menu,
    open,
    handle(edges) {
      if (languages.isOpen) {
        languages.handle(edges);
        return;
      }
      if (edges.back && view !== 'main') {
        open(parentOf(view));
        return;
      }
      if (view === 'leaderboard' && leaderboard?.handle(edges) === true) {
        return;
      }
      if (view === 'credits' && calmNow && edges.up !== edges.down) {
        credits.scroll(edges.down ? 1 : -1);
        return;
      }
      menu.handle(edges);
    },
    follow(heard, still) {
      calmNow = still;
      painter.paint(
        heard === null || view !== 'main' || languages.isOpen ? null : thanks.at(heard.beats),
        still,
        heard?.beats ?? 0,
      );
      if (heard === null || still) {
        origin = null;
        show(TITLE_AT_REST);
        return;
      }
      origin = heardFrom(origin, heard.beats);
      show(titleLightOf(heard, heard.beats - origin));
    },
    setOptions(options) {
      calm.set(options.calmMode);
      sound.set(options);
      mixSound.set(options);
      for (const bus of SOUND_BUSES) {
        buses[bus].set(options.mix[bus]);
      }
      hitSound.set(options.hitSound);
      autoFire.set(options.autoFire);
      autoAim.set(options.autoAim);
      pseudo.set(options.pseudo);
    },
    setVisits(count) {
      const text = tn(count, '{count} visit', '{count} visits', {
        count: formatNumber(count),
      });
      setText(visits, text);
      visits.hidden = false;
    },
    setLeaderboard(board) {
      leaderboard?.set(board);
    },
    setChangelogNews(news) {
      version.toggleAttribute('data-news', news && changelog !== null);
    },
    setDevice(next) {
      if (next === device && keysShown === prompts.version()) {
        return;
      }
      device = next;
      keysShown = prompts.version();
      languages.setDevice(next);
      showHint();
    },
  };
}
