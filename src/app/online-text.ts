import type { RefusalReason } from '../net/room';
import { t, tn } from '../shared/i18n';
import type { PlayerId, PlayerState } from '../sim/state';
import { formatNumber } from '../ui/format';
import { playerLabel } from '../ui/hud-model';

export function refusalText(reason: RefusalReason): string {
  switch (reason) {
    case 'version':
      return t('Reload the page');
    case 'full':
      return t('Room full');
    case 'started':
      return t('The game has already started');
  }
}

export function connectionText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('networks cannot reach each other')) {
    return t('The room exists, but your networks can’t reach each other');
  }
  if (message.includes('no room with the code')) {
    return t('No room has this code');
  }
  if (message.includes('already taken')) {
    return t('This code is taken, try again');
  }
  if (message.includes('did not answer') || message.includes('no answer from')) {
    return t('No answer: try again, or check the code');
  }
  return t('Can’t connect ({message})', { message });
}

export function hostSilentText(seconds: number): string {
  return tn(
    seconds,
    'No sign of the host for {seconds} second.',
    'No sign of the host for {seconds} seconds.',
    { seconds: formatNumber(seconds) },
  );
}

export function guestLeftText(
  players: readonly Pick<PlayerState, 'id' | 'name'>[],
  playerId: PlayerId,
): string {
  const player = players.find((candidate) => candidate.id === playerId);
  return t('{name} left the set', {
    name: player === undefined ? t('A player') : playerLabel(player),
  });
}
