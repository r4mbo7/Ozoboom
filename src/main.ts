import './style.css';
import './app/app.css';
import { DevUrlError, type DevOptions, readDevOptions } from './app/dev';
import { startGame } from './app/game';
import { startLocale } from './app/locale';
import { CONTENT } from './data/content';
import { DEFAULT_BPM, beatPeriodMs } from './shared/tempo';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #app root element');
}

// A font loads at its first glyph: the menus' heading weight would flash in a fallback face the first time.
for (const face of [
  '900 1em "Cinzel Decorative"',
  '700 1em "Cinzel Decorative"',
  '400 1em "Space Grotesk"',
  '700 1em "Space Grotesk"',
]) {
  void document.fonts.load(face);
}

root.style.setProperty('--beat', `${beatPeriodMs(DEFAULT_BPM).toFixed(1)}ms`);
function devOptions(page: HTMLElement): DevOptions {
  try {
    return readDevOptions(window.location.search, CONTENT);
  } catch (error) {
    if (error instanceof DevUrlError) {
      page.textContent = error.message;
    }
    throw error;
  }
}

startLocale();
await startGame(root, devOptions(root));
