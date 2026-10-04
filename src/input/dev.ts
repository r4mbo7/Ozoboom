import '../style.css';
import { navigatorGamepads, selectGamepad } from './gamepad';
import { createInputSource } from './index';
import type { InputDevice, InputSnapshot } from './intents';

const DEVICE_LABELS: Readonly<Record<InputDevice, string>> = {
  keyboardMouse: 'Clavier et souris',
  gamepad: 'Manette',
  touch: 'Tactile',
  none: 'Aucun périphérique',
};

function find<T extends Element>(selector: string, type: abstract new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing ${type.name} ${selector}`);
  return element;
}

const surface = find('#surface', HTMLElement);
const deviceBadge = find('#device', HTMLOutputElement);
const pointerRing = find('#pointer', SVGCircleElement);
const surfaceCenter = find('#center', SVGCircleElement);
const aimRay = find('#aim-ray', SVGLineElement);
const moveDot = find('#move-dot', SVGCircleElement);
const moveValue = find('#move-value', HTMLElement);
const aimLine = find('#aim-line', SVGLineElement);
const aimValue = find('#aim-value', HTMLElement);
const aimSource = find('#aim-source', HTMLElement);
const padStatus = find('#pad-status', HTMLElement);
const snapshotView = find('#snapshot', HTMLElement);
const rumbleButtons = [...document.querySelectorAll<HTMLButtonElement>('#rumble button')];
const heldRows = [...document.querySelectorAll<HTMLElement>('[data-held]')];
const countRows = new Map(
  [...document.querySelectorAll<HTMLElement>('[data-count]')].map((row) => [
    row.dataset.count ?? '',
    { row, output: row.querySelector('output'), count: 0 },
  ]),
);
const flashColor = getComputedStyle(document.documentElement).getPropertyValue('--uv-magenta');

const input = createInputSource(surface);
let selectedRumble = 0;

function format(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}

function bump(name: string, label?: string): void {
  const entry = countRows.get(name);
  if (entry === undefined) return;
  entry.count += 1;
  if (entry.output !== null) entry.output.textContent = label ?? String(entry.count);
  entry.row.animate(
    [{ backgroundColor: `color-mix(in srgb, ${flashColor} 40%, transparent)` }, {}],
    { duration: 400, easing: 'ease-out' },
  );
}

function playRumble(index: number): void {
  const button = rumbleButtons[index];
  if (button === undefined) return;
  input.rumble(Number(button.dataset.strength), Number(button.dataset.duration));
}

function selectRumble(index: number): void {
  selectedRumble = (index + rumbleButtons.length) % rumbleButtons.length;
  rumbleButtons.forEach((button, i) => {
    button.setAttribute('aria-current', String(i === selectedRumble));
  });
}

rumbleButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    selectRumble(index);
    playRumble(index);
  });
});
selectRumble(0);

function renderSurface(snapshot: InputSnapshot): void {
  const width = surface.clientWidth;
  const height = surface.clientHeight;
  const center = { x: width / 2, y: height / 2 };
  surfaceCenter.setAttribute('cx', String(center.x));
  surfaceCenter.setAttribute('cy', String(center.y));

  const pointer = snapshot.pointerScreen;
  pointerRing.style.visibility = pointer === null ? 'hidden' : 'visible';
  if (pointer !== null) {
    pointerRing.setAttribute('cx', String(pointer.x));
    pointerRing.setAttribute('cy', String(pointer.y));
  }

  const reach = Math.min(width, height) * 0.35;
  const { aim } = snapshot.gameplay;
  const tip =
    snapshot.aimFromPointer && pointer !== null
      ? pointer
      : { x: center.x + aim.x * reach, y: center.y + aim.y * reach };
  aimRay.setAttribute('x1', String(center.x));
  aimRay.setAttribute('y1', String(center.y));
  aimRay.setAttribute('x2', String(tip.x));
  aimRay.setAttribute('y2', String(tip.y));
}

function renderSticks(snapshot: InputSnapshot): void {
  const { move, aim } = snapshot.gameplay;
  moveDot.setAttribute('cx', String(move.x * 41));
  moveDot.setAttribute('cy', String(move.y * 41));
  moveValue.textContent = `${format(move.x)}, ${format(move.y)}`;
  aimLine.setAttribute('x2', String(aim.x * 44));
  aimLine.setAttribute('y2', String(aim.y * 44));
  aimLine.style.opacity = snapshot.aimFromPointer ? '0.35' : '1';
  aimValue.textContent = `${format(aim.x)}, ${format(aim.y)}`;
  aimSource.textContent = snapshot.aimFromPointer ? 'souris' : 'stick';
}

function renderIntents(snapshot: InputSnapshot): void {
  const { gameplay, menu } = snapshot;
  for (const row of heldRows) {
    const name = row.dataset.held;
    const on =
      name === 'fire' ? gameplay.fire : name === 'skill' ? gameplay.skill : gameplay.ultimate;
    row.toggleAttribute('data-on', on);
  }
  const pulses = {
    placeTrap: gameplay.placeTrap,
    nextTrap: gameplay.nextTrap,
    previousTrap: gameplay.previousTrap,
    pause: gameplay.pause,
    ...menu,
  };
  for (const [name, fired] of Object.entries(pulses)) if (fired) bump(name);
  if (gameplay.selectTrap !== null) bump('selectTrap', `n° ${String(gameplay.selectTrap + 1)}`);
}

let lastPadText = '';
function renderGamepad(): void {
  const pad = selectGamepad(navigatorGamepads(), null);
  const text =
    pad === null
      ? 'Aucune manette. Branchez-la puis appuyez sur un bouton.'
      : `${pad.id}\nmapping ${pad.mapping === 'standard' ? 'standard' : 'non standard'} · n° ${String(pad.index)} · ${pad.vibrationActuator ? 'vibration disponible' : 'pas de vibration'}`;
  if (text === lastPadText) return;
  lastPadText = text;
  const [title = '', details] = text.split('\n');
  padStatus.textContent = title;
  if (details !== undefined) {
    const small = document.createElement('small');
    small.textContent = details;
    padStatus.append(small);
  }
}

let lastSnapshotText = '';
function renderSnapshot(snapshot: InputSnapshot): void {
  const text = JSON.stringify(
    snapshot,
    (_, value: unknown) => (typeof value === 'number' ? Number(format(value)) : value),
    2,
  ).replace(/\{\n\s+"x": (\S+),\n\s+"y": (\S+)\n\s+\}/g, '{ "x": $1, "y": $2 }');
  if (text === lastSnapshotText) return;
  lastSnapshotText = text;
  snapshotView.textContent = text;
}

function frame(): void {
  const snapshot = input.poll();
  deviceBadge.dataset.device = snapshot.device;
  deviceBadge.textContent = DEVICE_LABELS[snapshot.device];
  if (snapshot.menu.left) selectRumble(selectedRumble - 1);
  if (snapshot.menu.right) selectRumble(selectedRumble + 1);
  if (snapshot.menu.confirm) playRumble(selectedRumble);
  renderSurface(snapshot);
  renderSticks(snapshot);
  renderIntents(snapshot);
  renderGamepad();
  renderSnapshot(snapshot);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
