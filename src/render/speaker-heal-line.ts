import { type Container, Graphics, type Sprite } from 'pixi.js';
import { frac } from '../shared/scalar';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { SetDefinition } from '../data/types';
import type { CoreState } from '../sim/state';
import type { Frame } from './frame';
import { LABEL_PAD, NAME_TEXTURE_SCALE } from './textures-names';
import { setTint } from './util';

// The bubble's repair line: three green pluses rising, as around the stage, then its words.
const ROW = 16;
const ICON = 15;
const GAP = 6;
const PLUSES = 3;
const PLUS_SPACING = 5;
const BEATS = 2;

// A speaker's bubble offers the repair while the set has one and the stage has life to take back.
export function offersRepair(
  set: Pick<SetDefinition, 'speakerCoreRepair'>,
  core: Pick<CoreState, 'hp' | 'maxHp'>,
): boolean {
  return (set.speakerCoreRepair ?? 0) > 0 && core.hp < core.maxHp;
}

export interface HealLine {
  readonly words: Sprite;
  readonly pluses: readonly Graphics[];
  // The row's width: the pluses, then the words.
  readonly width: number;
  shown: boolean;
  x: number;
  y: number;
}

export function createHealLine(card: Container, words: Sprite): HealLine {
  const pluses = Array.from({ length: PLUSES }, (_, index) => {
    const reach = 2.6 + 0.6 * (index % 2);
    return card
      .addChild(new Graphics())
      .moveTo(-reach, 0)
      .lineTo(reach, 0)
      .moveTo(0, -reach)
      .lineTo(0, reach)
      .stroke({ width: 1.8, color: 0xffffff, cap: 'round' });
  });
  const wordsWidth = words.texture.width / NAME_TEXTURE_SCALE - 2 * LABEL_PAD;
  return { words, pluses, width: ICON + GAP + wordsWidth, shown: false, x: 0, y: 0 };
}

// Lays the line out under `top`, centred in `width`; returns where the row ends.
export function placeHealLine(line: HealLine, shown: boolean, width: number, top: number): number {
  const left = (width - line.width) / 2;
  line.shown = line.words.visible = shown;
  line.x = left + ICON / 2;
  line.y = top + 1 + ROW / 2;
  line.words.position.set(Math.round(left + (ICON + GAP + line.width) / 2), Math.round(line.y));
  return line.y + ROW / 2;
}

export function riseHealLine(line: HealLine, frame: Frame): void {
  setTint(line.words, frame.palette.healer);
  for (const [index, plus] of line.pluses.entries()) {
    plus.visible = line.shown;
    const share = frame.calm
      ? (index + 0.5) / PLUSES
      : frac(frame.now / (BEATS * TICKS_PER_BEAT) + index / PLUSES);
    plus.position.set(
      line.x + (index - 1) * PLUS_SPACING,
      line.y + ROW / 2 - 2 - share * (ROW - 2),
    );
    plus.alpha = Math.sin(Math.PI * share);
    setTint(plus, frame.palette.healer);
  }
}
