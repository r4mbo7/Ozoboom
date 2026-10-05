import './style.css';
import './app/app.css';
import { readDevOptions } from './app/dev';
import { startGame } from './app/game';
import { CONTENT } from './data/content';
import { DEFAULT_BPM, beatPeriodMs } from './shared/tempo';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('Missing #app root element');
}

// A font loads when its first glyph is drawn: the heading weight of the menus would flash in a
// fallback face the first time one opens.
for (const face of [
  '900 1em "Cinzel Decorative"',
  '700 1em "Cinzel Decorative"',
  '400 1em "Space Grotesk"',
  '700 1em "Space Grotesk"',
]) {
  void document.fonts.load(face);
}

root.style.setProperty('--beat', `${beatPeriodMs(DEFAULT_BPM).toFixed(1)}ms`);
await startGame(root, readDevOptions(window.location.search, CONTENT));
