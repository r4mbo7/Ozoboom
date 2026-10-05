import '../style.css';
import { CLASSES } from '../data/classes';
import { generateCode, joinHash, normalizeCode, parseJoinCode } from './code';
import { createPeerTransport } from './peerjs';
import { createRoom, type Room } from './room';
import type { Transport } from './types';

const found = document.querySelector<HTMLElement>('#app');
if (found === null) {
  throw new Error('Missing #app root element');
}
const root: HTMLElement = found;

// ?version=x pretends to be another build, to see the host refuse it.
const version = new URLSearchParams(window.location.search).get('version') ?? __APP_VERSION__;

root.innerHTML = `
  <h1>Banc réseau</h1>
  <fieldset>
    <legend>Joueur</legend>
    <label>Nom <input id="name" value="Joueur" /></label>
    <label>Classe <select id="class">${CLASSES.map(
      (c) => `<option value="${c.id}">${c.name}</option>`,
    ).join('')}</select></label>
  </fieldset>
  <section>
    <button id="create" type="button">Créer un salon</button>
    <input id="code" placeholder="CODE" size="8" aria-label="Code du salon" />
    <button id="join" type="button">Rejoindre</button>
    <button id="start" type="button" hidden>Lancer</button>
  </section>
  <section>
    <p>Version <code id="version"></code> - état <strong id="status">hors salon</strong></p>
    <p>Code <code id="room-code"></code> - <a id="link" href="#"></a></p>
    <p id="error" role="alert"></p>
    <ul id="seats"></ul>
    <pre id="log"></pre>
  </section>
`;

function element<T extends HTMLElement>(id: string, type: abstract new () => T): T {
  const node = root.querySelector(`#${id}`);
  if (!(node instanceof type)) {
    throw new Error(`Missing #${id}`);
  }
  return node;
}

const nameInput = element('name', HTMLInputElement);
const classSelect = element('class', HTMLSelectElement);
const codeInput = element('code', HTMLInputElement);
const startButton = element('start', HTMLButtonElement);
const statusNode = element('status', HTMLElement);
const errorNode = element('error', HTMLElement);
const seatsNode = element('seats', HTMLElement);
const logNode = element('log', HTMLElement);
element('version', HTMLElement).textContent = version;

let transport: Transport | null = null;
let room: Room | null = null;

function log(line: string): void {
  logNode.textContent = `${logNode.textContent}${line}\n`;
}

function setStatus(status: string): void {
  statusNode.textContent = status;
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  errorNode.textContent = message;
  log(`erreur: ${message}`);
}

function renderSeats(): void {
  seatsNode.replaceChildren(
    ...(room?.seats ?? []).map((seat) => {
      const item = document.createElement('li');
      item.textContent = `${String(seat.playerId)} - ${seat.name} - ${seat.classId}`;
      return item;
    }),
  );
}

async function open(role: 'host' | 'guest', code: string): Promise<void> {
  if (transport !== null) {
    return;
  }
  setStatus('connexion');
  errorNode.textContent = '';
  element('room-code', HTMLElement).textContent = code;
  const link = element('link', HTMLAnchorElement);
  link.href = `${window.location.pathname}${window.location.search}${joinHash(code)}`;
  link.textContent = link.href;
  try {
    const opened = await createPeerTransport({ role, code, onError: showError });
    transport = opened;
    opened.onMessage((from, message) => {
      log(`${from} -> ${message.type}`);
    });
    opened.onPeer((peer, change) => {
      log(`${peer} ${change}`);
    });
    room = createRoom(opened, role, {
      version,
      name: nameInput.value,
      classId: classSelect.value,
      classIds: CLASSES.map((c) => c.id),
    });
    room.onChange(renderSeats);
    room.onRefused((reason, hostVersion) => {
      setStatus(`refusé: ${reason}`);
      log(`refusé (${reason}), version de l'hôte ${hostVersion}`);
    });
    room.onStart((start) => {
      setStatus('partie lancée');
      log(`start ${JSON.stringify(start.players)}`);
    });
    renderSeats();
    setStatus(role === 'host' ? 'salon ouvert' : 'dans le salon');
    startButton.hidden = role !== 'host';
  } catch (error) {
    setStatus('échec');
    showError(error);
  }
}

element('create', HTMLElement).addEventListener('click', () => {
  const code = generateCode();
  void open('host', code);
});

element('join', HTMLElement).addEventListener('click', () => {
  const code = normalizeCode(codeInput.value);
  if (code === null) {
    showError(new Error('code invalide'));
    return;
  }
  void open('guest', code);
});

startButton.addEventListener('click', () => {
  room?.start('dev', 0);
});

nameInput.addEventListener('change', () => room?.setSeat({ name: nameInput.value }));
classSelect.addEventListener('change', () => room?.setSeat({ classId: classSelect.value }));

const fromHash = parseJoinCode(window.location.hash);
if (fromHash !== null) {
  codeInput.value = fromHash;
  void open('guest', fromHash);
}
