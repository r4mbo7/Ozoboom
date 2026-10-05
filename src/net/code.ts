export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const PEER_ID_PREFIX = 'ozoboom-';

const JOIN_PARAMETER = 'rejoindre';

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 is a multiple of the alphabet size, so the modulo does not bias the draw.
  return Array.from(bytes, (byte) => CODE_ALPHABET.charAt(byte % CODE_ALPHABET.length)).join('');
}

export function normalizeCode(input: string): string | null {
  const code = input.replace(/\s+/g, '').toUpperCase();
  const valid =
    code.length === CODE_LENGTH && Array.from(code).every((c) => CODE_ALPHABET.includes(c));
  return valid ? code : null;
}

export function parseJoinCode(hash: string): string | null {
  const match = new RegExp(`^#?${JOIN_PARAMETER}=(.*)$`, 'i').exec(hash.trim());
  if (match?.[1] === undefined) {
    return null;
  }
  try {
    return normalizeCode(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function joinHash(code: string): string {
  return `#${JOIN_PARAMETER}=${code}`;
}

export function hostPeerId(code: string): string {
  return PEER_ID_PREFIX + code;
}
