import { describe, expect, it } from 'vitest';
import { SETS } from './sets';
import { SOIREE_OUVERTURE, TRACKS } from './tracks';

function pitchClass(scale: readonly number[], degree: number): number {
  const size = scale.length;
  return scale[((degree % size) + size) % size] ?? NaN;
}

describe('TRACKS', () => {
  it('names every track once', () => {
    const ids = TRACKS.map((track) => track.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('plays seven note scales that rise from the root within the octave', () => {
    for (const track of TRACKS) {
      for (const scale of [track.scale, track.themeScale ?? track.scale]) {
        expect(scale).toHaveLength(7);
        expect(scale[0]).toBe(0);
        expect([...scale].sort((a, b) => a - b)).toEqual(scale);
        expect(Math.max(...scale)).toBeLessThan(12);
      }
    }
  });

  it('keeps the pitch of every chord root when the theme changes the scale', () => {
    for (const track of TRACKS) {
      const theme = track.themeScale ?? track.scale;
      for (const chord of track.chords) {
        expect(pitchClass(theme, chord), track.id).toBe(pitchClass(track.scale, chord));
      }
    }
  });

  it('writes every part as whole notes in its loop, in order, without overlap', () => {
    for (const track of TRACKS) {
      for (const part of track.parts) {
        const label = `${track.id} ${part.voice}`;
        expect(Number.isInteger(part.loopSteps) && part.loopSteps > 0, label).toBe(true);
        part.notes.forEach(([step, degree, steps], index) => {
          const next = part.notes[index + 1]?.[0] ?? part.loopSteps;
          expect(Number.isInteger(step) && step >= 0, label).toBe(true);
          expect(Number.isInteger(degree), label).toBe(true);
          expect(Number.isInteger(steps) && steps > 0, label).toBe(true);
          expect(step + steps, label).toBeLessThanOrEqual(next);
        });
      }
    }
  });
});

describe('SOIREE_OUVERTURE', () => {
  const theme = SOIREE_OUVERTURE.parts.find((part) => part.layer === 'theme');
  const hijaz = SOIREE_OUVERTURE.themeScale ?? [];

  it('ties the oriental theme over four bars of sixteenths', () => {
    const notes = theme?.notes ?? [];
    const ends = notes.map(([step, , steps]) => step + steps);
    const starts = [...notes.slice(1).map(([step]) => step), 64];

    expect(theme?.loopSteps).toBe(64);
    expect(notes[0]?.[0]).toBe(0);
    expect(ends).toEqual(starts);
  });

  it('leans on the flat second and the major third of the hijaz mode', () => {
    const pitchClasses = new Set(
      (theme?.notes ?? []).map(([, degree]) => pitchClass(hijaz, degree)),
    );

    expect(pitchClasses).toContain(1);
    expect(pitchClasses).toContain(4);
  });

  it('raises only the third of the phrygian scale for its theme', () => {
    const changed = SOIREE_OUVERTURE.scale.flatMap((semitones, degree) =>
      hijaz[degree] === semitones ? [] : [degree],
    );

    expect(changed).toEqual([2]);
  });
});

describe('the Dome tracks', () => {
  const dome = SETS.find((set) => set.id === 'dome');
  const tracks = (dome?.trackIds ?? []).map((id) => TRACKS.find((track) => track.id === id));

  it('plays the five tracks of the Dome in their own keys', () => {
    expect(tracks.map((track) => track?.name)).toEqual([
      'Sous la coupole',
      'Route de la soie',
      'Dub des champignons',
      'La cérémonie',
      'Mandala de feu',
    ]);
    expect(tracks.map((track) => (track?.rootMidi ?? 0) % 12)).toEqual([2, 4, 7, 5, 1]);
    expect(tracks.map((track) => track?.scale[1])).toEqual([2, 1, 2, 2, 2]);
  });

  it('gives each one a kit of its own, whose hits fall inside their loops', () => {
    for (const track of tracks) {
      expect(track?.drums?.length, track?.id).toBeGreaterThan(0);
      for (const drum of track?.drums ?? []) {
        const label = `${track?.id ?? ''} ${drum.voice}`;
        const steps = drum.hits.map(([step]) => step);
        expect(steps, label).toEqual([...new Set(steps)].sort((a, b) => a - b));
        expect(Math.min(...steps), label).toBeGreaterThanOrEqual(0);
        expect(Math.max(...steps), label).toBeLessThan(drum.loopSteps);
        expect(
          drum.hits.every(([, gain]) => gain > 0 && gain <= 1),
          label,
        ).toBe(true);
      }
    }
  });

  it('shapes the dome kits after the validated prototypes', () => {
    const drums = (id: string) => TRACKS.find((track) => track.id === id)?.drums ?? [];
    const steps = (id: string, voice: string, heard?: string) =>
      drums(id)
        .filter((drum) => drum.voice === voice && drum.in === heard)
        .flatMap((drum) => drum.hits.map(([step]) => step))
        .sort((a, b) => a - b);

    expect(steps('sous-la-coupole', 'rim', 'rise')).toEqual([8]);
    expect(steps('sous-la-coupole', 'rim', 'drop')).toEqual([]);
    expect(steps('route-de-la-soie', 'doum', 'light')).toEqual([0]);
    expect(steps('dub-des-champignons', 'hat-open', undefined)).toEqual([2, 6, 10, 14]);
    expect(steps('la-ceremonie', 'tom', undefined)).toEqual([60, 61, 62, 63]);
    expect(steps('la-ceremonie', 'tom', 'rise')).toEqual([8]);
    expect(steps('la-ceremonie', 'frame-drum', 'light')).toEqual([0]);
    expect(steps('mandala-de-feu', 'kick', 'drop')).toEqual([0, 2, 5, 8, 10, 13]);
    expect(steps('mandala-de-feu', 'kick', 'rise')).toEqual([0, 10]);
  });
});
