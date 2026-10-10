import { describe, expect, it } from 'vitest';
import { nextFloat, seedRng, type RngState } from '../shared/prng';
import type { PlayerAction, PlayerCommand } from '../sim/commands';
import type { PlayerId } from '../sim/state';
import type { NetMessage } from './types';
import { decodeMessage, encodeMessage, quantizeCommand } from './wire';

const ids: readonly PlayerId[] = [0, 1, 2, 3];

function unit(rng: RngState): { x: number; y: number } {
  const angle = nextFloat(rng) * 2 * Math.PI;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function randomCommand(rng: RngState, playerId: PlayerId): PlayerCommand {
  const actions: PlayerAction[] = [];
  const roll = nextFloat(rng);
  if (roll < 0.15) {
    const facing = unit(rng);
    actions.push({
      type: 'placeTrap',
      trapId: 'subwoofer',
      x: nextFloat(rng) * 1000,
      y: nextFloat(rng) * 1000,
      dx: facing.x,
      dy: facing.y,
    });
  } else if (roll < 0.25) {
    actions.push({ type: 'chooseUpgrade', upgradeId: 'écho-profond' });
  } else if (roll < 0.3) {
    actions.push({ type: 'takeTrap', x: nextFloat(rng) * 1000, y: nextFloat(rng) * 1000 });
  }
  return {
    playerId,
    input: {
      move: { x: nextFloat(rng) * 2 - 1, y: nextFloat(rng) * 2 - 1 },
      aim: unit(rng),
      fire: nextFloat(rng) < 0.5,
      skill: nextFloat(rng) < 0.2,
    },
    actions,
  };
}

function bytes(message: NetMessage): Uint8Array {
  const wire = encodeMessage(message);
  if (typeof wire === 'string') throw new Error('expected bytes');
  return wire;
}

describe('quantizeCommand', () => {
  it('keeps the flags, the actions and the aim and move within a thousandth', () => {
    const rng = seedRng(7);

    for (let i = 0; i < 500; i++) {
      const command = randomCommand(rng, ids[i % 4] ?? 0);
      const decoded = quantizeCommand(command);

      expect(decoded.playerId).toBe(command.playerId);
      expect(decoded.input.fire).toBe(command.input.fire);
      expect(decoded.input.skill).toBe(command.input.skill);
      expect(decoded.actions).toHaveLength(command.actions.length);
      expect(Math.abs(decoded.input.move.x - command.input.move.x)).toBeLessThan(1e-4);
      expect(Math.abs(decoded.input.move.y - command.input.move.y)).toBeLessThan(1e-4);
      expect(Math.abs(decoded.input.aim.x - command.input.aim.x)).toBeLessThan(1e-4);
      expect(Math.abs(decoded.input.aim.y - command.input.aim.y)).toBeLessThan(1e-4);
    }
  });

  it('is idempotent: a decoded command quantizes to itself', () => {
    const rng = seedRng(8);

    for (let i = 0; i < 500; i++) {
      const once = quantizeCommand(randomCommand(rng, ids[i % 4] ?? 0));
      const twice = quantizeCommand(once);

      expect(twice).toEqual(once);
    }
  });

  it('keeps the idle input exact', () => {
    const command: PlayerCommand = {
      playerId: 2,
      input: {
        move: { x: 0, y: 0 },
        aim: { x: 1, y: 0 },
        fire: false,
        skill: false,
      },
      actions: [],
    };

    expect(quantizeCommand(command)).toEqual(command);
  });

  it('clamps an input outside the unit square', () => {
    const command = randomCommand(seedRng(1), 0);
    command.input.move = { x: 3, y: -3 };

    expect(quantizeCommand(command).input.move).toEqual({ x: 1, y: -1 });
  });
});

describe('encodeMessage and decodeMessage', () => {
  it('round-trips a command and a frame of a seeded sample', () => {
    const rng = seedRng(9);
    const commands = ids.map((id) => quantizeCommand(randomCommand(rng, id)));
    const first = commands[0];
    if (first === undefined) throw new Error('no command');

    const command = decodeMessage(bytes({ type: 'command', tick: 123_456, command: first }));
    const frame = decodeMessage(bytes({ type: 'frame', tick: 123_456, commands }));

    expect(command).toEqual({ type: 'command', tick: 123_456, command: first });
    expect(frame).toEqual({ type: 'frame', tick: 123_456, commands });
  });

  it('sends a command without action in 10 bytes plus its header, a frame of four in under 50', () => {
    const rng = seedRng(10);
    const idle = quantizeCommand({ ...randomCommand(rng, 1), actions: [] });

    const command = bytes({ type: 'command', tick: 1000, command: idle });
    const frame = bytes({ type: 'frame', tick: 1000, commands: [idle, idle, idle, idle] });

    expect(command.length).toBe(1 + 2 + 10);
    expect(frame.length).toBeLessThan(50);
  });

  it('keeps the rare messages as readable JSON text', () => {
    const message: NetMessage = { type: 'hash', tick: 48, hash: 'abc' };

    expect(encodeMessage(message)).toBe('{"type":"hash","tick":48,"hash":"abc"}');
    expect(decodeMessage(encodeMessage(message))).toEqual(message);
  });

  it('reads an ArrayBuffer and a view as PeerJS may hand them over', () => {
    const command = quantizeCommand(randomCommand(seedRng(11), 3));
    const encoded = bytes({ type: 'command', tick: 5, command });
    const padded = new Uint8Array(encoded.length + 3);
    padded.set(encoded, 3);

    expect(decodeMessage(encoded.buffer)).toMatchObject({ type: 'command', command });
    expect(decodeMessage(padded.subarray(3))).toMatchObject({ type: 'command', command });
  });

  it('rejects what is not ours', () => {
    const encoded = bytes({
      type: 'command',
      tick: 5,
      command: quantizeCommand(randomCommand(seedRng(12), 1)),
    });

    expect(() => decodeMessage(42)).toThrow();
    expect(() => decodeMessage('not json')).toThrow();
    expect(() => decodeMessage('{"tick":1}')).toThrow();
    expect(() => decodeMessage(new Uint8Array([9, 0]))).toThrow('unknown message');
    expect(() => decodeMessage(encoded.subarray(0, encoded.length - 1))).toThrow('cut short');
    expect(() => decodeMessage(new Uint8Array([...encoded, 0]))).toThrow('trailing');
  });
});
