import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateCode, hostPeerId, joinHash, parseJoinCode } from './code';

describe('generateCode', () => {
  it('draws six characters from the unambiguous alphabet', () => {
    const codes = Array.from({ length: 200 }, generateCode);

    for (const code of codes) {
      expect(code).toHaveLength(6);
      expect(Array.from(code).every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(new Set(codes).size).toBeGreaterThan(190);
  });

  it('never uses 0, O, 1 or I', () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
    expect(CODE_ALPHABET).toHaveLength(32);
  });
});

describe('parseJoinCode', () => {
  it('reads the code of a join fragment', () => {
    expect(parseJoinCode('#rejoindre=ABC234')).toBe('ABC234');
  });

  it('tolerates case and spaces', () => {
    expect(parseJoinCode('#rejoindre=abc%20234 ')).toBe('ABC234');
    expect(parseJoinCode('#REJOINDRE= abc 234')).toBe('ABC234');
  });

  it('rejects anything else', () => {
    expect(parseJoinCode('')).toBeNull();
    expect(parseJoinCode('#autre=ABC234')).toBeNull();
    expect(parseJoinCode('#rejoindre=ABC23')).toBeNull();
    expect(parseJoinCode('#rejoindre=ABC2345')).toBeNull();
    expect(parseJoinCode('#rejoindre=ABC0O1')).toBeNull();
    expect(parseJoinCode('#rejoindre=%E0')).toBeNull();
  });

  it('round-trips with joinHash', () => {
    const code = generateCode();

    expect(parseJoinCode(joinHash(code))).toBe(code);
  });
});

describe('hostPeerId', () => {
  it('prefixes the code', () => {
    expect(hostPeerId('ABC234')).toBe('ozoboom-ABC234');
  });
});
