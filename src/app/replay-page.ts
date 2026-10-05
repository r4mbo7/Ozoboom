import { hashState } from '../sim/replay';
import { REPLAY_SCRIPTS } from '../sim/replay-scripts';

declare global {
  interface Window {
    ozoboomReplay?: Record<string, string>;
  }
}

const hashes: Record<string, string> = {};
const list = document.querySelector('#hashes');
for (const script of REPLAY_SCRIPTS) {
  const hash = hashState(script.run());
  hashes[script.id] = hash;
  const row = document.createElement('li');
  row.dataset.script = script.id;
  row.textContent = `${script.id} ${hash}`;
  list?.append(row);
}
window.ozoboomReplay = hashes;
