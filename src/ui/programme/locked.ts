import type { TeaserDefinition } from '../../data/types';
import { t } from '../../shared/i18n';
import type { ProgrammeEntry } from './types';

// The full game's entries, in the demo: each its shape in shadow, its name, and its style when it has one.
export function lockedEntries(
  teasers: readonly TeaserDefinition[],
  kind: string,
  glyph: string,
): ProgrammeEntry[] {
  return teasers.map((teaser, index) => ({
    id: `locked-${teaser.kind}-${String(index)}`,
    name: t(teaser.name),
    kind,
    portrait: { glyph },
    color: teaser.color,
    ...(teaser.style === undefined ? {} : { chips: [t(teaser.style)] }),
    figures: [],
    locked: true,
  }));
}
