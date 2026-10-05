export const MAX_PLAYER_NAME_LENGTH = 12;

export function trimPlayerName(name: string): string {
  return name.trim().slice(0, MAX_PLAYER_NAME_LENGTH).trim();
}
