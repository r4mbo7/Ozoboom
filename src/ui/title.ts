import type { InputDevice, MenuIntents } from '../input/intents';
import { el, fillHint, keycap, setText } from './dom';
import { formatNumber } from './format';
import { createActionButton, createFeedbackButton } from './feedback-button';
import { openDiscord } from './discord';
import { DISCORD } from './icons';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';
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
  toggleCalmMode(): void;
  toggleMute(): void;
  stepVolume(side: -1 | 1): void;
  toggleHitSound(): void;
  toggleAutoFire(): void;
  toggleAutoAim(): void;
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

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  handle(edges: MenuIntents): void;
  setOptions(options: TitleOptions): void;
  setDevice(device: InputDevice): void;
  setVisits(count: number): void;
  // The menu ambience as heard, in eighths; null stills the title.
  follow(position: number | null): void;
}

const CENTRE = 385;
const HORIZON = 145;
const RAYS = 11;
const DISC = 120;
// The text of the title, taller than its line: from here down the sun is veiled.
const TEXT_TOP = 38;
const VEIL = 0.3;
const REFLECTION_REACHES = [140, 109, 80, 53, 27];

function sunPoint(radius: number, turn: number): string {
  const x = CENTRE + radius * Math.cos(turn);
  const y = HORIZON - radius * Math.sin(turn);
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

function halfCircle(radius: number): string {
  const left = String(CENTRE - radius);
  const right = String(CENTRE + radius);
  const size = String(radius);
  return `M${left} ${String(HORIZON)}A${size} ${size} 0 0 1 ${right} ${String(HORIZON)}`;
}

const SUN =
  '<svg class="ui-title__sun" viewBox="0 0 770 200" aria-hidden="true" focusable="false"><defs>' +
  `<radialGradient id="ui-title-glow" cx="${String(CENTRE)}" cy="${String(HORIZON)}" r="210" ` +
  'gradientUnits="userSpaceOnUse"><stop offset="0" stop-opacity="0.5"/>' +
  '<stop offset="0.45" stop-opacity="0.2"/><stop offset="1" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="ui-title-horizon" x1="20" x2="750" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-opacity="0"/><stop offset="0.2"/><stop offset="0.8"/>' +
  '<stop offset="1" stop-opacity="0"/></linearGradient>' +
  `<clipPath id="ui-title-sky"><rect y="-70" width="770" height="${String(HORIZON + 70)}"/>` +
  '</clipPath>' +
  `<linearGradient id="ui-title-fade" x2="0" y1="${String(HORIZON - DISC)}" y2="${String(TEXT_TOP)}" ` +
  `gradientUnits="userSpaceOnUse"><stop offset="0"/><stop offset="1" stop-opacity="${String(VEIL)}"/>` +
  '</linearGradient><mask id="ui-title-veil" maskUnits="userSpaceOnUse" x="0" y="-70" width="770" ' +
  'height="270"><rect y="-70" width="770" height="270" fill="url(#ui-title-fade)"/></mask></defs>' +
  '<g mask="url(#ui-title-veil)">' +
  `<circle class="ui-title__sun-glow" cx="${String(CENTRE)}" cy="${String(HORIZON)}" r="210" ` +
  'fill="url(#ui-title-glow)" clip-path="url(#ui-title-sky)"/>' +
  '<path class="ui-title__sun-rays" d="' +
  Array.from({ length: RAYS }, (_, index) => {
    const turn = ((index + 1) * Math.PI) / (RAYS + 1);
    return `M${sunPoint(DISC + 10, turn)}L${sunPoint(index % 2 === 0 ? HORIZON : HORIZON - 9, turn)}`;
  }).join('') +
  '"/>' +
  `<path class="ui-title__sun-ring" d="${halfCircle(DISC + 5)}"/>` +
  `<path class="ui-title__sun-disc" d="${halfCircle(DISC)}"/>` +
  `<path stroke="url(#ui-title-horizon)" stroke-width="1.4" d="M20 ${String(HORIZON)}H750"/></g>` +
  '<g class="ui-title__sun-water">' +
  REFLECTION_REACHES.map((reach, note) => {
    const depth = String(HORIZON + 18 + note * 6.5);
    return `<path style="--lit: var(--r${String(note)})" d="M${String(CENTRE - reach)} ${depth}H${String(CENTRE + reach)}"/>`;
  }).join('') +
  '</g></svg>';

export function createTitle(actions: TitleActions): TitleScreen {
  const element = el('section', 'ui-screen ui-title');
  element.setAttribute('aria-label', t('Écran titre'));

  const header = el('header', 'ui-title__header');
  const mark = el('div', 'ui-title__mark');
  mark.innerHTML = SUN;
  const logo = el('h1', 'ui-title__logo', 'Ozoboom');
  logo.dataset.text = 'Ozoboom';
  mark.append(logo);
  header.append(
    mark,
    el('p', 'ui-title__tagline', t('Défends le sound system jusqu’au lever du soleil.')),
  );

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
        mark.style.setProperty(name, text);
      }
    }
  };
  show(TITLE_AT_REST);
  let origin: number | null = null;

  const play = el('button', 'ui-button ui-button--primary', t('Jouer'));
  play.type = 'button';
  const together = el('button', 'ui-button', t('Jouer à plusieurs'));
  together.type = 'button';
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
  const language = createLanguageControl(locale());

  const items = [
    play,
    together,
    calm.button,
    sound.element,
    hitSound.button,
    autoFire.button,
    autoAim.button,
    language,
  ];
  if (actions.feedback !== undefined) {
    items.push(createFeedbackButton());
  }
  const discord = createActionButton(
    t('Backstage'),
    t('Passe dans les coulisses sur Discord'),
    DISCORD,
  );
  items.push(discord);

  const nav = el('nav', 'ui-menu');
  nav.setAttribute('aria-label', t('Menu principal'));
  nav.append(...items);

  const controls = el('section', 'ui-panel ui-controls');
  const controlsHead = el('div', 'ui-panel__head');
  const controlsTitle = el('h2', 'ui-panel__label');
  controlsHead.append(controlsTitle);
  const controlsList = el('dl', 'ui-controls__list');
  controls.append(controlsHead, controlsList);

  const hint = el('p', 'ui-hint');

  const meta = el('p', 'ui-title__meta', `v${__APP_RELEASE__}`);

  const body = el('div', 'ui-title__body');
  body.append(header, nav, controls, hint, meta);
  const languages = createLanguageList(
    locale(),
    (next) => {
      actions.chooseLocale(next);
    },
    () => {
      menu.select(items.indexOf(language));
    },
  );
  element.append(body, languages.element);

  const activations = [
    () => {
      actions.start();
    },
    () => {
      actions.playTogether();
    },
    () => {
      actions.toggleCalmMode();
    },
    () => {
      actions.toggleMute();
    },
    () => {
      actions.toggleHitSound();
    },
    () => {
      actions.toggleAutoFire();
    },
    () => {
      actions.toggleAutoAim();
    },
    () => {
      languages.open();
    },
    () => {
      actions.feedback?.();
    },
  ];
  const menu = createMenu(
    (index) => {
      if (items[index] === discord) {
        openDiscord();
        return;
      }
      activations[index]?.();
    },
    (index, side) => {
      if (items[index] === sound.element) {
        actions.stepVolume(side);
        return true;
      }
      return false;
    },
  );
  menu.setItems(items);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    handle(edges) {
      (languages.isOpen ? languages : menu).handle(edges);
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
      if (next === device) {
        return;
      }
      device = next;
      languages.setDevice(next);
      const prompts = promptsFor(next);
      setText(controlsTitle, t('Commandes · {device}', { device: prompts.name }));
      controlsList.replaceChildren(
        ...prompts.controls.map((control) => {
          const row = el('div', 'ui-controls__row');
          const keys = el('dd', 'ui-controls__keys');
          keys.append(...control.keys.map((key) => keycap(key, prompts.style)));
          row.append(el('dt', 'ui-controls__action', control.action), keys);
          return row;
        }),
      );
      fillHint(
        hint,
        [
          { keys: prompts.navigate, label: t('naviguer') },
          { keys: prompts.navigateRow, label: t('son') },
          { keys: [prompts.confirm], label: t('valider') },
        ],
        prompts.style,
      );
    },
  };
}
