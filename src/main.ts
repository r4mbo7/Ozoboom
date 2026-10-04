import './style.css';
import { DEFAULT_BPM, beatPeriodMs } from './shared/tempo';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('Missing #app root element');
}

root.style.setProperty('--beat', `${beatPeriodMs(DEFAULT_BPM).toFixed(1)}ms`);
root.innerHTML = `
  <section class="placeholder">
    <h1 class="placeholder__title">Ozoboom</h1>
    <p class="placeholder__tagline">Le sound system s'allume bientôt.</p>
  </section>
`;
