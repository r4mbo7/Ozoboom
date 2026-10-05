import type { PlayerAction, PlayerCommand } from '../sim/commands';
import type { PlayerId } from '../sim/state';
import type { NetMessage } from './types';

// The hot messages (one command per guest per tick, one frame per tick) are bytes; the rare ones
// (room, launch, hashes) stay JSON text, readable in the devtools.
//
//   command  0x01 | tick (varint) | command
//   frame    0x02 | tick (varint) | count (u8) | command...
//   command  playerId (u8) | flags (u8) | move.x, move.y, aim.x, aim.y (i16 each, units of 1/32767)
//            | actions, only when the flag is set: count (u8) | action...
//   flags    bit 0 fire, bit 1 skill, bit 2 ultimate, bit 3 has actions
//   action   0x00 placeTrap: id | x, y, dx, dy (f32)   0x01 chooseUpgrade: id
//   id       length (u8) | UTF-8

const COMMAND = 1;
const FRAME = 2;
const FIRE = 1;
const SKILL = 2;
const ULTIMATE = 4;
const ACTIONS = 8;
const PLACE_TRAP = 0;
const CHOOSE_UPGRADE = 1;
const AXIS_SCALE = 32767;
const MAX_COUNT = 255;
const MAX_PLAYER_ID = 3;

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
  return Math.round(Math.min(1, Math.max(-1, value)) * AXIS_SCALE);
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
  throw new RangeError(`unknown action ${String(type)}`);
}

function writeCommand(writer: Writer, command: PlayerCommand): void {
  const { input, actions } = command;
  if (actions.length > MAX_COUNT) {
    throw new RangeError(`too many actions in one command: ${String(actions.length)}`);
  }
  writer.u8(command.playerId);
  writer.u8(
    (input.fire ? FIRE : 0) |
      (input.skill ? SKILL : 0) |
      (input.ultimate ? ULTIMATE : 0) |
      (actions.length > 0 ? ACTIONS : 0),
  );
  writer.i16(axis(input.move.x));
  writer.i16(axis(input.move.y));
  writer.i16(axis(input.aim.x));
  writer.i16(axis(input.aim.y));
  if (actions.length > 0) {
    writer.u8(actions.length);
    actions.forEach((action) => {
      writeAction(writer, action);
    });
  }
}

function readCommand(reader: Reader): PlayerCommand {
  const playerId = reader.u8();
  if (playerId > MAX_PLAYER_ID) {
    throw new RangeError(`unknown player ${String(playerId)}`);
  }
  const flags = reader.u8();
  const move = { x: unaxis(reader.i16()), y: unaxis(reader.i16()) };
  const aim = { x: unaxis(reader.i16()), y: unaxis(reader.i16()) };
  const actions: PlayerAction[] = [];
  if ((flags & ACTIONS) !== 0) {
    for (let count = reader.u8(); count > 0; count--) {
      actions.push(readAction(reader));
    }
  }
  return {
    playerId: playerId as PlayerId,
    input: {
      move,
      aim,
      fire: (flags & FIRE) !== 0,
      skill: (flags & SKILL) !== 0,
      ultimate: (flags & ULTIMATE) !== 0,
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
    const parsed: unknown = JSON.parse(data);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('type' in parsed) ||
      typeof parsed.type !== 'string'
    ) {
      throw new TypeError('not a message');
    }
    return parsed as NetMessage;
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

// What a command is once it has crossed the wire. Online, every command enters the sim in this
// form, the host's own included: the host simulates what the guests decode.
export function quantizeCommand(command: PlayerCommand): PlayerCommand {
  const message = decodeMessage(encodeMessage({ type: 'command', tick: 0, command }));
  if (message.type !== 'command') {
    throw new Error('quantizeCommand: unreachable');
  }
  return message.command;
}
