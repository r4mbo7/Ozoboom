import '../style.css';
import { navigatorGamepads } from './gamepad';
import { createInputHub } from './hub';
import type { DeviceId, InputDevice, InputSnapshot } from './intents';

const DEVICE_LABELS: Readonly<Record<InputDevice, string>> = {
  keyboardMouse: 'Clavier et souris',
  gamepad: 'Manette',
  touch: 'Tactile',
  none: 'Aucun périphérique',
};

function find<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing ${type.name} ${selector}`);
  return element;
}

const container = find(document, '#devices', HTMLElement);
const countBadge = find(document, '#count', HTMLOutputElement);
const template = find(document, '#device-template', HTMLTemplateElement);
const flashColor = getComputedStyle(document.documentElement).getPropertyValue('--mage');

function format(value: number): string {
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}

function describe(device: DeviceId): { title: string; details: string } {
  if (device === 'keyboardMouse') {
    return { title: DEVICE_LABELS.keyboardMouse, details: 'toujours présent' };
  }
  const index = Number(device.slice('gamepad:'.length));
  const pad = navigatorGamepads().find((candidate) => candidate?.index === index);
  const details =
    pad === undefined || pad === null
      ? ''
      : `${pad.id} · mapping ${pad.mapping === 'standard' ? 'standard' : 'non standard'} · ${pad.vibrationActuator ? 'vibration disponible' : 'pas de vibration'}`;
  return { title: `${DEVICE_LABELS.gamepad} ${String(index + 1)}`, details };
}

class DeviceColumn {
  readonly root: HTMLElement;
  private readonly badge: HTMLOutputElement;
  private readonly mouse: {
    readonly surface: HTMLElement;
    readonly pointerRing: SVGCircleElement;
    readonly center: SVGCircleElement;
    readonly aimRay: SVGLineElement;
  } | null;
  private readonly moveDot: SVGCircleElement;
  private readonly moveValue: HTMLElement;
  private readonly aimLine: SVGLineElement;
  private readonly aimValue: HTMLElement;
  private readonly aimSource: HTMLElement;
  private readonly snapshotView: HTMLElement;
  private readonly rumbleButtons: HTMLButtonElement[];
  private readonly heldRows: HTMLElement[];
  private readonly countRows: Map<
    string,
    { row: HTMLElement; output: HTMLOutputElement | null; count: number }
  >;
  private selectedRumble = 0;
  private lastSnapshotText = '';
  private lastDescription = '';

  readonly device: DeviceId;

  constructor(device: DeviceId) {
    this.device = device;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    this.root = find(fragment, '.device', HTMLElement);
    this.root.dataset.deviceId = device;
    const kind = device === 'keyboardMouse' ? 'keyboardMouse' : 'gamepad';
    for (const section of this.root.querySelectorAll<HTMLElement>('[data-for]')) {
      if (section.dataset.for !== kind) section.remove();
    }
    const surface = this.root.querySelector('[data-surface]');
    this.mouse =
      surface instanceof HTMLElement
        ? {
            surface,
            pointerRing: find(surface, '[data-pointer]', SVGCircleElement),
            center: find(surface, '[data-center]', SVGCircleElement),
            aimRay: find(surface, '[data-aim-ray]', SVGLineElement),
          }
        : null;
    this.badge = find(this.root, '[data-badge]', HTMLOutputElement);
    this.moveDot = find(this.root, '[data-move-dot]', SVGCircleElement);
    this.moveValue = find(this.root, '[data-move-value]', HTMLElement);
    this.aimLine = find(this.root, '[data-aim-line]', SVGLineElement);
    this.aimValue = find(this.root, '[data-aim-value]', HTMLElement);
    this.aimSource = find(this.root, '[data-aim-source]', HTMLElement);
    this.snapshotView = find(this.root, '[data-snapshot]', HTMLElement);
    this.rumbleButtons = [...this.root.querySelectorAll<HTMLButtonElement>('.rumble button')];
    this.heldRows = [...this.root.querySelectorAll<HTMLElement>('[data-held]')];
    this.countRows = new Map(
      [...this.root.querySelectorAll<HTMLElement>('[data-count]')].map((row) => [
        row.dataset.count ?? '',
        { row, output: row.querySelector('output'), count: 0 },
      ]),
    );
    this.rumbleButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        this.selectRumble(index);
        this.playRumble(index);
      });
    });
    this.selectRumble(0);
    container.append(this.root);
  }

  get pointerTarget(): HTMLElement {
    if (this.mouse === null) throw new Error('Only the keyboard and mouse column has a surface');
    return this.mouse.surface;
  }

  update(snapshot: InputSnapshot): void {
    this.badge.dataset.device = snapshot.device;
    this.badge.textContent = DEVICE_LABELS[snapshot.device];
    this.describe();
    if (this.rumbleButtons.length > 0) {
      if (snapshot.menu.left) this.selectRumble(this.selectedRumble - 1);
      if (snapshot.menu.right) this.selectRumble(this.selectedRumble + 1);
      if (snapshot.menu.confirm) this.playRumble(this.selectedRumble);
    }
    this.renderSurface(snapshot);
    this.renderSticks(snapshot);
    this.renderIntents(snapshot);
    this.renderSnapshot(snapshot);
  }

  private describe(): void {
    const { title, details } = describe(this.device);
    const text = `${title}\n${details}`;
    if (text === this.lastDescription) return;
    this.lastDescription = text;
    find(this.root, '[data-title]', HTMLElement).textContent = title;
    find(this.root, '[data-details]', HTMLElement).textContent = details;
  }

  private bump(name: string, label?: string): void {
    const entry = this.countRows.get(name);
    if (entry === undefined) return;
    entry.count += 1;
    if (entry.output !== null) entry.output.textContent = label ?? String(entry.count);
    entry.row.animate(
      [{ backgroundColor: `color-mix(in srgb, ${flashColor} 40%, transparent)` }, {}],
      { duration: 400, easing: 'ease-out' },
    );
  }

  private playRumble(index: number): void {
    const button = this.rumbleButtons[index];
    if (button === undefined) return;
    hub.rumble(this.device, Number(button.dataset.strength), Number(button.dataset.duration));
  }

  private selectRumble(index: number): void {
    if (this.rumbleButtons.length === 0) return;
    this.selectedRumble = (index + this.rumbleButtons.length) % this.rumbleButtons.length;
    this.rumbleButtons.forEach((button, i) => {
      button.setAttribute('aria-current', String(i === this.selectedRumble));
    });
  }

  private renderSurface(snapshot: InputSnapshot): void {
    if (this.mouse === null) return;
    const { surface, pointerRing, center: hubDot, aimRay } = this.mouse;
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    const center = { x: width / 2, y: height / 2 };
    hubDot.setAttribute('cx', String(center.x));
    hubDot.setAttribute('cy', String(center.y));

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

  private renderSticks(snapshot: InputSnapshot): void {
    const { move, aim } = snapshot.gameplay;
    this.moveDot.setAttribute('cx', String(move.x * 41));
    this.moveDot.setAttribute('cy', String(move.y * 41));
    this.moveValue.textContent = `${format(move.x)}, ${format(move.y)}`;
    this.aimLine.setAttribute('x2', String(aim.x * 44));
    this.aimLine.setAttribute('y2', String(aim.y * 44));
    this.aimLine.style.opacity = snapshot.aimFromPointer ? '0.35' : '1';
    this.aimValue.textContent = `${format(aim.x)}, ${format(aim.y)}`;
    this.aimSource.textContent = snapshot.aimFromPointer ? 'souris' : 'stick';
  }

  private renderIntents(snapshot: InputSnapshot): void {
    const { gameplay, menu } = snapshot;
    for (const row of this.heldRows) {
      const name = row.dataset.held;
      row.toggleAttribute('data-on', name === 'fire' ? gameplay.fire : gameplay.skill);
    }
    const pulses = {
      placeTrap: gameplay.placeTrap,
      nextTrap: gameplay.nextTrap,
      previousTrap: gameplay.previousTrap,
      pause: gameplay.pause,
      ...menu,
    };
    for (const [name, fired] of Object.entries(pulses)) if (fired) this.bump(name);
    if (gameplay.selectTrap !== null) {
      this.bump('selectTrap', `n° ${String(gameplay.selectTrap + 1)}`);
    }
  }

  private renderSnapshot(snapshot: InputSnapshot): void {
    const text = JSON.stringify(
      snapshot,
      (_, value: unknown) => (typeof value === 'number' ? Number(format(value)) : value),
      2,
    ).replace(/\{\n\s+"x": (\S+),\n\s+"y": (\S+)\n\s+\}/g, '{ "x": $1, "y": $2 }');
    if (text === this.lastSnapshotText) return;
    this.lastSnapshotText = text;
    this.snapshotView.textContent = text;
  }
}

const keyboardMouseColumn = new DeviceColumn('keyboardMouse');
const hub = createInputHub(keyboardMouseColumn.pointerTarget);
const columns = new Map<DeviceId, DeviceColumn>([['keyboardMouse', keyboardMouseColumn]]);

function frame(): void {
  const snapshots = hub.poll();
  let changed = false;
  for (const [device, column] of columns) {
    if (snapshots.has(device)) continue;
    column.root.remove();
    columns.delete(device);
    changed = true;
  }
  for (const [device, snapshot] of snapshots) {
    let column = columns.get(device);
    if (column === undefined) {
      column = new DeviceColumn(device);
      columns.set(device, column);
      changed = true;
    }
    column.update(snapshot);
  }
  if (changed) {
    for (const device of snapshots.keys()) {
      const { root } = columns.get(device) ?? keyboardMouseColumn;
      container.append(root);
    }
  }
  countBadge.textContent = `${String(snapshots.size)} périphérique${snapshots.size > 1 ? 's' : ''}`;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
