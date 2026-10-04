import type { InputDevice } from '../input/intents';
import type { SimState } from '../sim/state';
import { formatDuration } from '../ui/format';

export interface FeedbackMeta {
  version: string;
  device: InputDevice;
  userAgent: string;
  viewport: { width: number; height: number; pixelRatio: number };
  calmMode: boolean;
  averageFps: number | null;
}

const MAX_USER_AGENT = 250;

export function buildFeedbackReport(state: SimState | null, meta: FeedbackMeta): string {
  const lines = [`version: ${meta.version}`];
  if (state !== null) {
    const { stats } = state;
    lines.push(
      `seed: ${String(state.seed)}`,
      `class: ${state.players.map((player) => player.classId).join(', ')}`,
      `tier: ${String(state.set.tier)}`,
      `phrase: ${String(state.set.phrase)}`,
      `tick: ${String(state.tick)} (${formatDuration(state.tick)})`,
      `status: ${state.status}`,
      `stats: kills ${whole(stats.kills)}, phrasesHeld ${whole(stats.phrasesHeld)}, damageDealt ${whole(stats.damageDealt)}, vibesCollected ${whole(stats.vibesCollected)}, wattsSpent ${whole(stats.wattsSpent)}`,
    );
  }
  const { width, height, pixelRatio } = meta.viewport;
  lines.push(
    `device: ${meta.device}`,
    `browser: ${oneShortLine(meta.userAgent, MAX_USER_AGENT)}`,
    `screen: ${whole(width)}x${whole(height)} @${String(Math.round(pixelRatio * 100) / 100)}x`,
    `calm: ${meta.calmMode ? 'yes' : 'no'}`,
  );
  if (meta.averageFps !== null) {
    lines.push(`fps: ${whole(meta.averageFps)}`);
  }
  return lines.join('\n');
}

function whole(value: number): string {
  return String(Math.round(value));
}

function oneShortLine(text: string, max: number): string {
  const characters = Array.from(text.replace(/\s+/g, ' ').trim());
  const line = characters.slice(0, max).join('');
  return characters.length > max ? `${line.trimEnd()}…` : line;
}
