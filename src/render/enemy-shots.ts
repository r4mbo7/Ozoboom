const TAU = Math.PI * 2;

export interface ShotLook {
  readonly shape: 'enemyShot' | 'bottle';
  readonly spins: boolean;
  readonly tinted: boolean;
}

const COMMON: ShotLook = { shape: 'enemyShot', spins: false, tinted: true };

const LOOKS: Readonly<Record<string, ShotLook>> = {
  meprisant: { shape: 'bottle', spins: true, tinted: false },
};

export function enemyShotLook(kind: string | undefined): ShotLook {
  return (kind === undefined ? undefined : LOOKS[kind]) ?? COMMON;
}

export function shotRotation(
  vx: number,
  vy: number,
  now: number,
  ticksPerBeat: number,
  spins: boolean,
  calm: boolean,
): number {
  const heading = Math.atan2(vy, vx);
  return spins && !calm ? heading + TAU * ((now / ticksPerBeat) % 1) : heading;
}
