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

  it('plays every track a stage names', () => {
    const ids = new Set(TRACKS.map((track) => track.id));

    for (const set of SETS) {
      expect(set.trackIds.length, set.id).toBeGreaterThan(0);
      expect(
        set.trackIds.filter((id) => !ids.has(id)),
        set.id,
      ).toEqual([]);
    }
  });

  it('keeps every drum hit inside its loop, once per step, at a gain up to 1', () => {
    for (const track of TRACKS) {
      for (const drum of track.drums ?? []) {
        const label = `${track.id} ${drum.voice}`;
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

  it('gives each one a kit of its own', () => {
    for (const track of tracks) {
      expect(track?.drums?.length, track?.id).toBeGreaterThan(0);
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

describe('Premier rayon', () => {
  const ambyss = SETS.find((set) => set.id === 'ambyss');
  const track = TRACKS.find((candidate) => candidate.id === ambyss?.trackIds[0]);

  it('plays at Ambyss in E major over vi-IV-I-V', () => {
    expect(ambyss?.trackIds).toContain('premier-rayon');
    expect(track?.name).toBe('Premier rayon');
    expect((track?.rootMidi ?? 0) % 12).toBe(4);
    expect(track?.scale).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(track?.chords).toEqual([5, 3, 0, 4]);
  });

  it('keeps a soft kick on the four beats, silent in the break', () => {
    const kicks = (heard: string) =>
      (track?.drums ?? [])
        .filter((drum) => drum.voice === 'kick' && drum.in === heard)
        .flatMap((drum) => drum.hits.map(([step]) => step));

    expect(kicks('drop')).toEqual([0, 4, 8, 12]);
    expect(kicks('rise')).toEqual([0, 4, 8, 12]);
    expect(track?.drums?.every((drum) => drum.in === 'rise' || drum.in === 'drop')).toBe(true);
  });

  it('cries the strings louder in the break, and doubles them an octave up in the drop', () => {
    const strings = (track?.parts ?? []).filter((part) => part.voice === 'strings');

    expect(strings.map((part) => [part.in, part.octave, part.gain])).toEqual([
      ['light', 3, 1.6],
      ['drop', 3, 1],
      ['drop', 4, 0.45],
    ]);
  });
});

describe('Sous la voile', () => {
  const track = TRACKS.find((candidate) => candidate.id === 'sous-la-voile');
  const steps = (voice: string, heard?: string) =>
    (track?.drums ?? [])
      .filter((drum) => drum.voice === voice && drum.in === heard && drum.loopSteps === 32)
      .flatMap((drum) => drum.hits.map(([step]) => step))
      .sort((a, b) => a - b);

  it('plays at Ambyss in C dorian, each chord over two bars', () => {
    expect(SETS.find((set) => set.id === 'ambyss')?.trackIds).toContain('sous-la-voile');
    expect((track?.rootMidi ?? 1) % 12).toBe(0);
    expect(track?.scale).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(track?.chords).toEqual([0, 0, 4, 4, 0, 0, 3, 3]);
  });

  it('bounces its echo and softens its build', () => {
    expect(track?.echo?.wide).toBe(true);
    expect(track?.build).toBe('soft');
  });

  it('plays half-time: two kicks and two snares over two bars', () => {
    expect(steps('kick', 'rise')).toEqual([0, 16]);
    expect(steps('kick', 'drop')).toEqual([0, 16, 22]);
    expect(steps('snare', 'drop')).toEqual([8, 24]);
  });

  it('slides its bass down to the root, then jumps to the fifth', () => {
    const bass = track?.parts.find((part) => part.voice === 'glide-sub');

    expect(bass?.notes.map(([step, degree]) => [step, degree])).toEqual([
      [0, 0],
      [24, 4],
      [30, 0],
    ]);
    expect(bass?.accents).toEqual([0]);
  });

  it('rolls three tuned drums down into every eighth bar', () => {
    const roll = (track?.drums ?? []).filter((drum) => drum.loopSteps === 128);

    expect(roll.map((drum) => drum.hz)).toEqual([294, 220, 147]);
    expect(roll.flatMap((drum) => drum.hits.map(([step]) => step))).toEqual([
      120, 122, 124, 125, 126, 127,
    ]);
  });

  it('sings the bansuri on the fifth, sparse in the buildup and whole from the break', () => {
    const flutes = (track?.parts ?? []).filter((part) => part.voice === 'bansuri');

    expect(flutes.map((part) => part.layer)).toEqual(['lead', 'theme']);
    expect(flutes.map((part) => part.notes[1]?.[1])).toEqual([4, 4]);
    expect(flutes[0]?.notes.length).toBeLessThan(flutes[1]?.notes.length ?? 0);
  });
});
