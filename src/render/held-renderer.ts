import type { RenderGroup } from 'pixi.js';
import { RendererUnavailable } from './webgl';

// A renderer made when wanted and let go a while after it is no longer wanted, so that its WebGL
// context is held only while it serves. A refused context leaves it absent until wanted again.
export interface HeldRenderer<R> {
  readonly current: R | null;
  // Makes the renderer unless it exists or is being made, and keeps it. A refusal is expected and
  // kept quiet; any other failure is left unhandled, for the crash report to count.
  want(): void;
  // Lets the renderer go after `releaseAfterMs`, unless it is wanted again before.
  idle(): void;
}

export interface HeldRendererHooks {
  readonly releaseAfterMs: number;
  // The renderer is made: what waited for it can draw.
  readonly onReady: () => void;
}

export function holdRenderer<R extends { destroy(): void }>(
  create: () => Promise<R>,
  hooks: HeldRendererHooks,
): HeldRenderer<R> {
  let current: R | null = null;
  let making: Promise<void> | null = null;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  function release(): void {
    releaseTimer = null;
    current?.destroy();
    current = null;
  }

  return {
    get current() {
      return current;
    },
    want() {
      if (releaseTimer !== null) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      if (current !== null) {
        return;
      }
      making ??= create().then(
        (made) => {
          making = null;
          current = made;
          hooks.onReady();
        },
        (error: unknown) => {
          making = null;
          if (!(error instanceof RendererUnavailable)) {
            throw error;
          }
        },
      );
    },
    idle() {
      releaseTimer ??= setTimeout(release, hooks.releaseAfterMs);
    },
  };
}

// Pixi builds a stage's draw instructions for the renderer that draws it: a stage drawn again by
// the renderer made after a release would replay those of the one before, so they are built anew.
export function rebuildInstructions(group: RenderGroup): void {
  group.structureDidChange = true;
  for (const child of group.renderGroupChildren) {
    rebuildInstructions(child);
  }
}
