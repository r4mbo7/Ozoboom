import { describe, expect, it } from 'vitest';
import { MAIN_TEMPO, tempoOf, type Tempo } from '../shared/tempo';
import { TICK_SECONDS, type Anchor } from './clock';
import { createVibeArp, type VibeNote } from './vibe-arp';

const ANCHOR: Anchor = { tick: 0, time: 10 };
const timeOf = (tick: number) => ANCHOR.time + tick * TICK_SECONDS;
const tickOf = (note: VibeNote | null | undefined) =>
  note == null ? null : Math.round(((note.at - ANCHOR.time) / TICK_SECONDS) * 1000) / 1000;

// One call per tick of the game, a quarter of a tick after it: the engine calls once per tick.
function collected(
  vibesPerTick: readonly number[],
  tempo: Tempo = MAIN_TEMPO,
  anchor: Anchor | null = ANCHOR,
): (VibeNote | null)[] {
  const arp = createVibeArp();
  return vibesPerTick.map((vibes, tick) => arp.collect(vibes, timeOf(tick + 0.25), tempo, anchor));
}

const notesOf = (calls: readonly (VibeNote | null)[]) =>
  calls.filter((note): note is VibeNote => note !== null);

const ticks = (count: number, vibes: number) => Array.from({ length: count }, () => vibes);

describe('createVibeArp', () => {
  it('holds a vibe until the next sixteenth of the set', () => {
    const calls = collected([0, 1, 0, 0]);

    expect(calls.map(tickOf)).toEqual([null, null, 3, null]);
  });

  it('waits for the sixteenth of a slower stage', () => {
    const calls = collected([0, 1, 0, 0, 0, 0], tempoOf(18));

    expect(calls.map(tickOf)).toEqual([null, null, null, null, 4.5, null]);
  });

  it('plays at once when no set plays', () => {
    const calls = collected([0, 1], MAIN_TEMPO, null);

    expect(calls[1]).toEqual({ at: timeOf(1.25), bar: 0, degree: 0, vibes: 1 });
  });

  it('merges the vibes of one sixteenth into one note', () => {
    const calls = collected([0, 2, 1, 0, 0, 0]);

    expect(notesOf(calls).map((note) => note.vibes)).toEqual([3]);
  });

  it('caps a note at five vibes', () => {
    const calls = collected([0, 4, 4, 0, 0, 0]);

    expect(notesOf(calls).map((note) => note.vibes)).toEqual([5]);
  });

  it('plays one note per sixteenth while vibes keep coming', () => {
    const notes = notesOf(collected(ticks(13, 1)));

    expect(notes.map(tickOf)).toEqual([0.25, 3, 6, 9, 12]);
  });

  it('climbs the arpeggio two octaves, then comes back down to the root', () => {
    const notes = notesOf(collected([0, ...ticks(39, 1)]));

    expect(notes.map((note) => note.degree)).toEqual([0, 2, 4, 7, 9, 11, 14, 11, 9, 7, 4, 2, 0]);
  });

  it('restarts from the root after two beats without a vibe', () => {
    const twoBeats = 2 * MAIN_TEMPO.ticksPerBeat;

    const kept = notesOf(collected([0, 1, 0, 0, 1, ...ticks(twoBeats - 2, 0), 1, 0, 0]));
    const lost = notesOf(collected([0, 1, 0, 0, 1, ...ticks(twoBeats, 0), 1, 0, 0]));

    expect(kept.map((note) => note.degree)).toEqual([0, 2, 4]);
    expect(lost.map((note) => note.degree)).toEqual([0, 2, 0]);
  });

  it('names the bar its sixteenth falls in, not the bar of the vibe', () => {
    const calls = collected([...ticks(46, 0), 1, 0, 0]);

    expect(notesOf(calls).map((note) => [tickOf(note), note.bar])).toEqual([[48, 1]]);
  });
});
