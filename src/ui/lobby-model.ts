import type { SetDefinition } from '../data/types';
import type { MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { wrap } from '../shared/scalar';
import { setTempo, stageMinutes } from '../sim/lineup';
import type { PlayerId } from '../sim/state';
import type { HintPart } from './dom';
import type { DevicePrompts, KeyStyle } from './prompts';
import type { LobbyModel, LobbySeat, StageCard } from './types';

export const NAME_LENGTH = 12;
const ROOM_LINK = /rejoindre=([^&\s]+)/i;

// A code typed by hand or pasted from the link: spaces and case do not matter.
export function normalizeRoomCode(raw: string): string {
  const linked = ROOM_LINK.exec(raw);
  return (linked?.[1] ?? raw).replace(/\s+/g, '').toUpperCase();
}

export function roomCodeFromHash(hash: string): string {
  return normalizeRoomCode(ROOM_LINK.exec(hash)?.[0] ?? '');
}

export { defaultName } from '../shared/i18n';

export function seatName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH).trim();
}

export function stepClass(
  classes: readonly { id: string }[],
  current: string,
  delta: number,
  taken: ReadonlySet<string> = new Set(),
): string | null {
  const free = classes.filter((entry) => entry.id === current || !taken.has(entry.id));
  if (free.length < 2) {
    return null;
  }
  const index = Math.max(
    free.findIndex((entry) => entry.id === current),
    0,
  );
  const next = (((index + delta) % free.length) + free.length) % free.length;
  return free[next]?.id ?? null;
}

export type LobbyView = 'entry' | 'room';

export function lobbyView(model: LobbyModel): LobbyView {
  return model.code === null ? 'entry' : 'room';
}

export function ownSeat(model: LobbyModel): LobbySeat | null {
  return model.seats.find((seat) => !seat.remote) ?? null;
}

export function seatAt(model: LobbyModel, playerId: PlayerId): LobbySeat | null {
  return model.seats.find((seat) => seat.playerId === playerId) ?? null;
}

export function seatTag(seat: LobbySeat): string {
  if (seat.remote) {
    return seat.host ? t('Hôte') : t('Invité');
  }
  return seat.host ? t('Toi · hôte') : t('Toi');
}

export interface LobbyHint {
  parts: readonly HintPart[];
  style: KeyStyle;
}

export function lobbyHint(model: LobbyModel, prompts: DevicePrompts): LobbyHint {
  const view = lobbyView(model);
  const tabs =
    model.role === 'host' && prompts.tabs.length > 0 && view !== 'entry'
      ? [{ keys: prompts.tabs, label: t('mode') }]
      : [];
  const choice = {
    keys: prompts.navigateRow,
    label: hasStageChoice(model) ? t('classe, scène') : t('classe'),
  };
  return {
    parts: [
      { keys: prompts.navigate, label: t('naviguer') },
      ...tabs,
      ...(view === 'entry' ? [] : [choice]),
      { keys: [prompts.confirm], label: t('valider') },
      { keys: [prompts.back], label: t('quitter') },
    ],
    style: prompts.style,
  };
}

export type Row =
  'create' | 'discord' | 'code' | 'join' | 'copy' | 'name' | 'class' | 'stage' | 'launch' | 'leave';

export function stageCards(sets: readonly SetDefinition[]): StageCard[] {
  return sets.map((set) => ({
    setId: set.id,
    name: set.name,
    style: set.style ?? '',
    bpm: setTempo(set).bpm,
    decor: set.decor,
    minutes: stageMinutes(set),
  }));
}

function hasStageChoice(model: LobbyModel): boolean {
  return (model.stages?.length ?? 0) > 1;
}

export function rowsOf(model: LobbyModel): readonly Row[] {
  if (lobbyView(model) === 'entry') {
    return ['create', 'discord', 'code', 'join', 'leave'];
  }
  const own = ownSeat(model);
  const rows: Row[] = [];
  if (own?.host === true) {
    rows.push('copy');
  }
  if (own !== null) {
    rows.push('name', 'class');
  }
  if (own?.host === true) {
    if (hasStageChoice(model)) {
      rows.push('stage');
    }
    rows.push('launch');
  }
  rows.push('leave');
  return rows;
}

export interface RowStep {
  index: number;
  confirmed: boolean;
  back: boolean;
  side: -1 | 0 | 1;
}

export function stepRow(count: number, index: number, edges: MenuIntents): RowStep {
  const side = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
  const delta = (edges.down ? 1 : 0) - (edges.up ? 1 : 0);
  const next = count <= 0 ? 0 : wrap(index + delta, count);
  return {
    index: next,
    confirmed: edges.confirm,
    back: edges.back,
    side: side > 0 ? 1 : side < 0 ? -1 : 0,
  };
}
