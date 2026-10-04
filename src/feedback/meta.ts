import type { FeedbackMeta } from './report';

export const APP_VERSION: string = __APP_VERSION__;

export function feedbackMeta(
  game: Pick<FeedbackMeta, 'device' | 'calmMode' | 'averageFps'>,
): FeedbackMeta {
  return {
    ...game,
    version: APP_VERSION,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
    },
  };
}
