import { isOneOf, isRecord } from '../shared/guards';
import { clamp } from '../shared/scalar';
import { EMOTES, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { PlayerSlot } from '../sim/initial-state';
import { PLAYER_IDS } from '../sim/state';
import type { NetMessage, Seat } from './types';

const COMMAND = 1;
const FRAME = 2;
const FIRE = 1;
const SKILL = 2;
const ACTIONS = 4;
const FIRE_TICKS = 8;
const MAX_FIRE_TICKS = 0xffff;
const PLACE_TRAP = 0;
const CHOOSE_UPGRADE = 1;
const TAKE_TRAP = 2;
const DASH = 3;
const EMOTE = 4;
const LEAVE = 5;
const AXIS_SCALE = 32767;
const MAX_COUNT = 255;
const REFUSALS = ['version', 'full', 'started'] as const satisfies readonly Extract<
  NetMessage,
  { type: 'refused' }
>['reason'][];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

class Writer {
  private bytes = new Uint8Array(64);
  private view = new DataView(this.bytes.buffer);
  private length = 0;

  private reserve(extra: number): void {
    if (this.length + extra <= this.bytes.length) {
      return;
    }
    const grown = new Uint8Array(Math.max(this.bytes.length * 2, this.length + extra));
    grown.set(this.bytes);
    this.bytes = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(value: number): void {
    this.reserve(1);
    this.bytes[this.length++] = value;
  }

  varint(value: number): void {
    let rest = value;
    while (rest >= 0x80) {
      this.u8((rest % 0x80) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.u8(rest);
  }

  i16(value: number): void {
    this.reserve(2);
    this.view.setInt16(this.length, value);
    this.length += 2;
  }

  f32(value: number): void {
    this.reserve(4);
    this.view.setFloat32(this.length, value);
    this.length += 4;
  }

  id(value: string): void {
    const encoded = textEncoder.encode(value);
    if (encoded.length > MAX_COUNT) {
      throw new RangeError(`identifier too long for the wire: ${value}`);
    }
    this.u8(encoded.length);
    this.reserve(encoded.length);
    this.bytes.set(encoded, this.length);
    this.length += encoded.length;
  }

  done(): Uint8Array {
    return this.bytes.slice(0, this.length);
  }
}

class Reader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private at = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private take(count: number): number {
    if (this.at + count > this.bytes.length) {
      throw new RangeError('message cut short');
    }
    const start = this.at;
    this.at += count;
    return start;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  varint(): number {
    let value = 0;
    let factor = 1;
    for (let i = 0; i < 8; i++) {
      const byte = this.u8();
      value += (byte & 0x7f) * factor;
      if (byte < 0x80) {
        return value;
      }
      factor *= 0x80;
    }
    throw new RangeError('varint too long');
  }

  i16(): number {
    return this.view.getInt16(this.take(2));
  }

  f32(): number {
    return this.view.getFloat32(this.take(4));
  }

  id(): string {
    const length = this.u8();
    const start = this.take(length);
    return textDecoder.decode(this.bytes.subarray(start, start + length));
  }

  end(): void {
    if (this.at !== this.bytes.length) {
      throw new RangeError('trailing bytes in message');
    }
  }
}

function axis(value: number): number {
  return Math.round(clamp(value, -1, 1) * AXIS_SCALE);
}

function unaxis(value: number): number {
  return value / AXIS_SCALE;
}

function writeAction(writer: Writer, action: PlayerAction): void {
  if (action.type === 'placeTrap') {
    writer.u8(PLACE_TRAP);
    writer.id(action.trapId);
    writer.f32(action.x);
    writer.f32(action.y);
    writer.f32(action.dx);
    writer.f32(action.dy);
  } else if (action.type === 'takeTrap') {
    writer.u8(TAKE_TRAP);
    writer.f32(action.x);
    writer.f32(action.y);
  } else if (action.type === 'dash') {
    writer.u8(DASH);
  } else if (action.type === 'emote') {
    writer.u8(EMOTE);
    writer.u8(EMOTES.indexOf(action.emote));
  } else if (action.type === 'leave') {
    writer.u8(LEAVE);
  } else {
    writer.u8(CHOOSE_UPGRADE);
    writer.id(action.upgradeId);
  }
}

function readAction(reader: Reader): PlayerAction {
  const type = reader.u8();
  if (type === PLACE_TRAP) {
    const trapId = reader.id();
    return {
      type: 'placeTrap',
      trapId,
      x: reader.f32(),
      y: reader.f32(),
      dx: reader.f32(),
      dy: reader.f32(),
    };
  }
  if (type === CHOOSE_UPGRADE) {
    return { type: 'chooseUpgrade', upgradeId: reader.id() };
  }
  if (type === TAKE_TRAP) {
    return { type: 'takeTrap', x: reader.f32(), y: reader.f32() };
  }
  if (type === DASH) {
    return { type: 'dash' };
  }
  if (type === LEAVE) {
    return { type: 'leave' };
  }
  if (type === EMOTE) {
    const index = reader.u8();
    const emote = EMOTES[index];
    if (emote === undefined) {
      throw new RangeError(`unknown emote ${String(index)}`);
    }
    return { type: 'emote', emote };
  }
  throw new RangeError(`unknown action ${String(type)}`);
}

function writeCommand(writer: Writer, command: PlayerCommand): void {
  const { input, actions } = command;
  if (actions.length > MAX_COUNT) {
    throw new RangeError(`too many actions in one command: ${String(actions.length)}`);
  }
  const fireTicks = input.fire ? input.fireTicks : undefined;
  writer.u8(command.playerId);
  writer.u8(
    (input.fire ? FIRE : 0) |
      (input.skill ? SKILL : 0) |
      (actions.length > 0 ? ACTIONS : 0) |
      (fireTicks === undefined ? 0 : FIRE_TICKS),
  );
  writer.i16(axis(input.move.x));
  writer.i16(axis(input.move.y));
  writer.i16(axis(input.aim.x));
  writer.i16(axis(input.aim.y));
  if (fireTicks !== undefined) {
    writer.varint(clamp(Math.round(fireTicks), 1, MAX_FIRE_TICKS));
  }
  if (actions.length > 0) {
    writer.u8(actions.length);
    actions.forEach((action) => {
      writeAction(writer, action);
    });
  }
}

function readCommand(reader: Reader): PlayerCommand {
  const playerId = reader.u8();
  if (!isOneOf(playerId, PLAYER_IDS)) {
    throw new RangeError(`unknown player ${String(playerId)}`);
  }
  const flags = reader.u8();
  const move = { x: unaxis(reader.i16()), y: unaxis(reader.i16()) };
  const aim = { x: unaxis(reader.i16()), y: unaxis(reader.i16()) };
  const fireTicks = (flags & FIRE_TICKS) === 0 ? undefined : reader.varint();
  const actions: PlayerAction[] = [];
  if ((flags & ACTIONS) !== 0) {
    for (let count = reader.u8(); count > 0; count--) {
      actions.push(readAction(reader));
    }
  }
  return {
    playerId,
    input: {
      move,
      aim,
      fire: (flags & FIRE) !== 0,
      ...(fireTicks === undefined ? {} : { fireTicks }),
      skill: (flags & SKILL) !== 0,
    },
    actions,
  };
}

export function encodeMessage(message: NetMessage): string | Uint8Array {
  if (message.type !== 'command' && message.type !== 'frame') {
    return JSON.stringify(message);
  }
  const writer = new Writer();
  if (message.type === 'command') {
    writer.u8(COMMAND);
    writer.varint(message.tick);
    writeCommand(writer, message.command);
  } else {
    if (message.commands.length > MAX_COUNT) {
      throw new RangeError(`too many commands in one frame: ${String(message.commands.length)}`);
    }
    writer.u8(FRAME);
    writer.varint(message.tick);
    writer.u8(message.commands.length);
    message.commands.forEach((command) => {
      writeCommand(writer, command);
    });
  }
  return writer.done();
}

// Throws on anything that is not a message of ours: the transport reports it as an error.
export function decodeMessage(data: unknown): NetMessage {
  if (typeof data === 'string') {
    return readText(JSON.parse(data));
  }
  let bytes: Uint8Array;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else {
    throw new TypeError('not a message');
  }
  const reader = new Reader(bytes);
  const kind = reader.u8();
  const tick = reader.varint();
  let message: NetMessage;
  if (kind === COMMAND) {
    message = { type: 'command', tick, command: readCommand(reader) };
  } else if (kind === FRAME) {
    const commands: PlayerCommand[] = [];
    for (let count = reader.u8(); count > 0; count--) {
      commands.push(readCommand(reader));
    }
    message = { type: 'frame', tick, commands };
  } else {
    throw new RangeError(`unknown message ${String(kind)}`);
  }
  reader.end();
  return message;
}

function readText(message: unknown): NetMessage {
  if (!isRecord(message)) {
    throw new TypeError('not a message');
  }
  switch (message.type) {
    case 'hello':
      return {
        type: 'hello',
        version: text(message.version),
        name: text(message.name),
        classId: text(message.classId),
      };
    case 'refused':
      return {
        type: 'refused',
        reason: oneOf(message.reason, REFUSALS),
        version: text(message.version),
      };
    case 'lobby':
      return {
        type: 'lobby',
        seats: list(message.seats, readSeat),
        ...(message.setId === undefined ? {} : { setId: text(message.setId) }),
        ...(message.endless === undefined ? {} : { endless: flag(message.endless) }),
        ...(message.festival === undefined ? {} : { festival: flag(message.festival) }),
      };
    case 'seat':
      return {
        type: 'seat',
        ...(message.name === undefined ? {} : { name: text(message.name) }),
        ...(message.classId === undefined ? {} : { classId: text(message.classId) }),
      };
    case 'start':
      return {
        type: 'start',
        seed: integer(message.seed),
        setId: text(message.setId),
        trackId: text(message.trackId),
        players: list(message.players, readSlot),
        ...(message.endless === undefined ? {} : { endless: flag(message.endless) }),
        ...(message.festival === undefined ? {} : { festival: flag(message.festival) }),
      };
    case 'hash':
      return { type: 'hash', tick: tick(message.tick), hash: text(message.hash) };
    case 'desync':
      return { type: 'desync', tick: tick(message.tick) };
    case 'bye':
      return { type: 'bye' };
    default:
      throw new TypeError(`not a message: ${String(message.type)}`);
  }
}

function readSeat(value: unknown): Seat {
  const seat = record(value);
  return {
    playerId: oneOf(seat.playerId, PLAYER_IDS),
    peer: seat.peer === null ? null : text(seat.peer),
    name: text(seat.name),
    classId: text(seat.classId),
  };
}

function readSlot(value: unknown): PlayerSlot {
  const slot = record(value);
  return {
    id: oneOf(slot.id, PLAYER_IDS),
    classId: text(slot.classId),
    ...(slot.name === undefined ? {} : { name: text(slot.name) }),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected an object, got ${String(value)}`);
  }
  return value;
}

function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected a list, got ${String(value)}`);
  }
  return value.map(read);
}

function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError(`expected a string, got ${String(value)}`);
  }
  return value;
}

function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`expected a boolean, got ${String(value)}`);
  }
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`expected an integer, got ${String(value)}`);
  }
  return value;
}

function tick(value: unknown): number {
  const count = integer(value);
  if (count < 0) {
    throw new RangeError(`negative tick ${String(count)}`);
  }
  return count;
}

function oneOf<T>(value: unknown, options: readonly T[]): T {
  if (!isOneOf(value, options)) {
    throw new RangeError(`unexpected ${String(value)}`);
  }
  return value;
}

// Online, every command enters the sim in this form, the host's own included.
export function quantizeCommand(command: PlayerCommand): PlayerCommand {
  const message = decodeMessage(encodeMessage({ type: 'command', tick: 0, command }));
  if (message.type !== 'command') {
    throw new Error('quantizeCommand: unreachable');
  }
  return message.command;
}
