import { RendererUnavailable } from '../render';

// The game's renderer, once started. When the browser refuses it, `explain` tells the player why
// instead of leaving a blank page, and the error goes on to the crash report all the same.
export async function startOrExplain<R>(started: Promise<R>, explain: () => void): Promise<R> {
  try {
    return await started;
  } catch (error) {
    if (error instanceof RendererUnavailable) {
      explain();
    }
    throw error;
  }
}
