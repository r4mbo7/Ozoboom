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

root.style.setProperty('--beat', `${beatPeriodMs(DEFAULT_BPM).toFixed(1)}ms`);
await startGame(root, readDevOptions(window.location.search, CONTENT));
