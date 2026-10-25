import type { InputDevice, MenuIntents } from '../input/intents';
import { el, fillHint, icon, setText } from './dom';
import { formatNumber } from './format';
import { createActionButton, createControlsButton, createFeedbackButton } from './feedback-button';
import { openDiscord } from './discord';
import { DISCORD, GEAR, GLOBE, PAD } from './icons';
import { type Menu, createMenu } from './menu';
import type { Prompts } from './prompts';
import { TITLE_AT_REST, type TitleLight, heardFrom, titleLightAt } from './title-light';
import {
  createAutoAimToggle,
  createAutoFireToggle,
  createHitSoundToggle,
  createToggle,
} from './toggle';
import { createSoundControl } from './volume';
import { createLanguageControl, createLanguageList } from './language';
import { locale, t, tn, type Locale } from '../shared/i18n';

export interface TitleActions {
  start(): void;
  playTogether(): void;
  playOnline(): void;
  toggleCalmMode(): void;
  toggleMute(): void;
  stepVolume(side: -1 | 1): void;
  toggleHitSound(): void;
  toggleAutoFire(): void;
  toggleAutoAim(): void;
  controls(): void;
  chooseLocale(locale: Locale): void;
  feedback?(): void;
}

export interface TitleOptions {
  readonly calmMode: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly hitSound: boolean;
  readonly autoFire: boolean;
  readonly autoAim: boolean;
}

export type TitleView = 'main' | 'together' | 'settings';

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  handle(edges: MenuIntents): void;
  // Back to the three entries, or straight into one of them.
  open(view: TitleView): void;
  setOptions(options: TitleOptions): void;
  setDevice(device: InputDevice): void;
  setVisits(count: number): void;
  // In eighths; null stills the title.
  follow(position: number | null): void;
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
  `y2="${String(HORIZON)}" gradientUnits="userSpaceOnUse">` +
  '<stop class="ui-title__disc-stop" offset="0" style="--a: 0.12"/>' +
  '<stop class="ui-title__disc-stop" offset="0.55" style="--a: 0.2"/>' +
  '<stop class="ui-title__disc-stop ui-title__ember" offset="1" style="--a: 0.62"/></linearGradient>' +
  '</defs><path class="ui-title__sun-rays" stroke="url(#ui-title-rays)" d="' +
  Array.from({ length: RAYS }, (_, index) => {
    const turn = ((index + 1) * Math.PI) / (RAYS + 1);
    const reach = DISC * (index % 2 === 0 ? 2.7 : 1.8);
    return `M${point(DISC + 16, turn)}L${point(reach, turn)}`;
  }).join('') +
  '"/>' +
  `<path class="ui-title__sun-disc" fill="url(#ui-title-disc)" d="M${String(CENTRE - DISC)} ` +
  `${String(HORIZON)}A${String(DISC)} ${String(DISC)} 0 0 1 ${String(CENTRE + DISC)} ${String(HORIZON)}"/>` +
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

export function createTitle(prompts: Prompts, actions: TitleActions): TitleScreen {
  const element = el('section', 'ui-screen ui-title');
  element.setAttribute('aria-label', t('Écran titre'));

  const sky = el('div', 'ui-title__sky');
  sky.innerHTML = NIGHT + GLOW + SUN;
  const water = el('div', 'ui-title__water');
  water.innerHTML = WATER;

  const header = el('header', 'ui-title__header');
  const mark = el('div', 'ui-title__mark');
  const logo = el('h1', 'ui-title__logo', 'Ozoboom');
  logo.dataset.text = 'Ozoboom';
  mark.append(logo);
  header.append(
    mark,
    el('p', 'ui-title__tagline', t('Défends le sound system jusqu’au lever du soleil.')),
  );
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

  const play = el('button', 'ui-button ui-button--primary', t('Jouer'));
  play.type = 'button';
  const together = createActionButton(t('À plusieurs'), t('Même écran ou en ligne'), PAD);
  const settings = createActionButton(t('Réglages'), t('Mode calme, commandes, langue'), GEAR);

  const same = createActionButton(t('Même écran'), t('Jusqu’à 4 joueurs'), PAD);
  const online = createActionButton(t('En ligne'), t('Avec tes amis'), GLOBE);

  const calm = createToggle(
    t('Mode calme'),
    t('Sans strobos, secousses ni halos forts'),
    t('Oui'),
    t('Non'),
  );
  const sound = createSoundControl((side) => {
    actions.stepVolume(side);
  });
  const hitSound = createHitSoundToggle();
  const autoFire = createAutoFireToggle();
  const autoAim = createAutoAimToggle();
  const keys = createControlsButton();
  const language = createLanguageControl(locale());
  const feedback = actions.feedback === undefined ? null : createFeedbackButton();

  const backButton = () => {
    const button = el('button', 'ui-button ui-title__back', t('Retour'));
    button.type = 'button';
    return button;
  };

  const discord = el('button', 'ui-title__discord');
  discord.type = 'button';
  discord.setAttribute('aria-label', t('Backstage'));
  discord.title = t('Passe dans les coulisses sur Discord');
  discord.append(icon('ui-title__discord-icon', DISCORD));

  const views: Record<TitleView, { title: string; items: HTMLElement[]; nav: HTMLElement }> = {
    main: {
      title: '',
      items: [play, together, sound.element, settings, discord],
      nav: el('nav', 'ui-menu'),
    },
    together: {
      title: t('À plusieurs'),
      items: [same, online, backButton()],
      nav: el('nav', 'ui-menu'),
    },
    settings: {
      title: t('Réglages'),
      items: [
        calm.button,
        hitSound.button,
        autoFire.button,
        autoAim.button,
        keys,
        language,
        ...(feedback === null ? [] : [feedback]),
        backButton(),
      ],
      nav: el('nav', 'ui-menu ui-menu--settings'),
    },
  };
  views.main.nav.setAttribute('aria-label', t('Menu principal'));
  views.main.nav.append(play, together, sound.element, settings);
  for (const name of ['together', 'settings'] as const) {
    views[name].nav.setAttribute('aria-label', views[name].title);
    views[name].nav.append(...views[name].items);
  }

  const hint = el('p', 'ui-hint');
  const deck = el('div', 'ui-title__deck');
  deck.append(views.main.nav, views.together.nav, views.settings.nav);

  const meta = el('p', 'ui-title__meta', `v${__APP_RELEASE__}`);

  const body = el('div', 'ui-title__body');
  body.append(sky, water, header, heading, deck, hint, meta, discord);
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
      together,
      () => {
        open('together');
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
      same,
      () => {
        actions.playTogether();
      },
    ],
    [
      online,
      () => {
        actions.playOnline();
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
  for (const name of ['together', 'settings'] as const) {
    const back = views[name].items.at(-1);
    if (back !== undefined) {
      activations.set(back, () => {
        open('main');
      });
    }
  }

  let view: TitleView = 'main';
  const menu = createMenu(
    (index) => {
      const item = views[view].items[index];
      if (item !== undefined) {
        activations.get(item)?.();
      }
    },
    (index, side) => {
      if (views[view].items[index] === sound.element) {
        actions.stepVolume(side);
        return true;
      }
      return false;
    },
  );

  function open(next: TitleView): void {
    const from = view;
    view = next;
    body.dataset.view = next;
    header.hidden = next !== 'main';
    heading.hidden = next === 'main';
    discord.hidden = next !== 'main';
    setText(heading, views[next].title);
    for (const [name, { nav }] of Object.entries(views)) {
      nav.hidden = name !== next;
    }
    menu.setItems(views[next].items);
    const opener = from === 'together' ? together : from === 'settings' ? settings : null;
    if (next === 'main' && opener !== null) {
      menu.select(views.main.items.indexOf(opener));
    }
    showHint();
  }

  let device: InputDevice | null = null;
  let keysShown = -1;

  function showHint(): void {
    if (device === null) {
      return;
    }
    const shown = prompts.for(device);
    fillHint(
      hint,
      [
        { keys: shown.navigate, label: t('naviguer') },
        ...(view === 'main' ? [{ keys: shown.navigateRow, label: t('son') }] : []),
        { keys: [shown.confirm], label: t('valider') },
        ...(view === 'main' ? [] : [{ keys: [shown.back], label: t('retour') }]),
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
        open('main');
        return;
      }
      menu.handle(edges);
    },
    follow(position) {
      if (position === null) {
        origin = null;
        show(TITLE_AT_REST);
        return;
      }
      origin = heardFrom(origin, position);
      show(titleLightAt(position, position - origin));
    },
    setOptions(options) {
      calm.set(options.calmMode);
      sound.set(options);
      hitSound.set(options.hitSound);
      autoFire.set(options.autoFire);
      autoAim.set(options.autoAim);
    },
    setVisits(count) {
      const visits = tn(count, '{count} visite', '{count} visites', {
        count: formatNumber(count),
      });
      setText(meta, `v${__APP_RELEASE__} · ${visits}`);
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
