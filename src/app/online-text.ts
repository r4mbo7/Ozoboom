import type { RefusalReason } from '../net/room';
import { t, tn } from '../shared/i18n';
import type { PlayerId, PlayerState } from '../sim/state';
import { formatNumber } from '../ui/format';
import { playerLabel } from '../ui/hud-model';

export function refusalText(reason: RefusalReason): string {
  switch (reason) {
    case 'version':
      return t('Recharge la page');
    case 'full':
      return t('Salon plein');
    case 'started':
      return t('La partie a déjà commencé');
  }
}

export function connectionText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('networks cannot reach each other')) {
    return t('Le salon existe, mais vos réseaux n’arrivent pas à se joindre');
  }
  if (message.includes('no room with the code')) {
    return t('Aucun salon ne porte ce code');
  }
  if (message.includes('already taken')) {
    return t('Ce code est déjà pris, réessaie');
  }
  if (message.includes('did not answer') || message.includes('no answer from')) {
    return t('Pas de réponse : réessaie, ou vérifie le code');
  }
  return t('Connexion impossible ({message})', { message });
}

export function hostSilentText(seconds: number): string {
  return tn(
    seconds,
    'Plus aucun signe de l’hôte depuis {seconds} seconde.',
    'Plus aucun signe de l’hôte depuis {seconds} secondes.',
    { seconds: formatNumber(seconds) },
  );
}

export function guestLeftText(
  players: readonly Pick<PlayerState, 'id' | 'name'>[],
  playerId: PlayerId,
): string {
  const player = players.find((candidate) => candidate.id === playerId);
  return t('{name} a quitté le set', {
    name: player === undefined ? t('Un joueur') : playerLabel(player),
  });
}
