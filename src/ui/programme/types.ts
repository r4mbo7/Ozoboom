// What the Programme draws and plays with: the app makes it, as the ui can neither draw nor play the game.
export interface ProgrammeArt {
  paintMask(canvas: HTMLCanvasElement, enemyId: string): void;
  // Plays the stage's music as the game plays it, until `quiet`.
  playStage(setId: string): void;
  // Stops what a « Listen » still plays and gives the title music back: the focus or the tab moved,
  // or the Programme closed.
  quiet(): void;
  paintClass(canvas: HTMLCanvasElement, classId: string): void;
  playSpecial(classId: string): void;
  // Plays a prop's sound as the game plays it; null for a prop the game keeps silent.
  weaponSound(weaponId: string): (() => void) | null;
}

// A still portrait: painted into a square canvas the screen sizes, an svg body in a 24 box drawn
// in the entry's colour, or an svg picture filling the frame through its square `viewBox`.
export type ProgrammePortrait =
  | { readonly paint: (canvas: HTMLCanvasElement) => void }
  | { readonly glyph: string }
  | { readonly picture: string; readonly viewBox: string };

// A row of a sheet: the value, and five pips filled as its share of the most the tab holds.
export interface Figure {
  readonly label: string;
  readonly value: number;
  readonly most: number;
  // The value as shown when its number alone does not say it, « 1 per beat ».
  readonly text?: string;
}

export interface ProgrammeEntry {
  readonly id: string;
  readonly name: string;
  // What the entry is, above its name on its sheet: « Bad vibe ».
  readonly kind: string;
  readonly portrait: ProgrammePortrait;
  readonly color?: string;
  // Printed as chips under its name on its sheet: a stage's style and tempo.
  readonly chips?: readonly string[];
  // Its line from the game data.
  readonly line?: string;
  // A second, smaller line under it: how a fusion is made.
  readonly note?: string;
  readonly figures: readonly Figure[];
  // The name of its special, under its figures.
  readonly special?: string;
  // Plays its sound as the game plays it: « Listen » on its sheet, and confirm on its tile.
  readonly listen?: () => void;
  // The demo shows the full game's entry as a silhouette: its sheet says « In the full game ».
  readonly locked?: true;
}

// A tab of the strip: its whole category as tiles, the selected one's sheet beside them.
export interface ProgrammeTab {
  readonly id: string;
  title(): string;
  // A short precision printed under the title, such as « (enemies) ».
  subtitle?(): string;
  entries(art: ProgrammeArt): readonly ProgrammeEntry[];
  // Its own board in place of the tiles: the Stages map.
  board?(entries: readonly ProgrammeEntry[]): ProgrammeBoard;
}

// A tab's own board: its entries where it lays them, the screen selecting them as it does tiles.
export interface ProgrammeBoard {
  readonly element: HTMLElement;
  // One per entry, in their order: the arrows step between them as they lie on screen.
  readonly stops: readonly HTMLElement[];
  // Shows the selected entry; the screen marks its stop.
  select(index: number): void;
  // Fits the room the screen gives it.
  lay(width: number, height: number): void;
}
