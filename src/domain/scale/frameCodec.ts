import {
  CMD,
  HEADER,
  KIND_FRESH,
  KIND_REPLAY,
  FLAG_STABLE,
  IMPEDANCE_OFFSET,
  MAX_FRAME_LEN,
  STALE_PARTIAL_MS,
} from './protocol';

/** Header (4) + LEN (1) + 0x03 + CMD + CS: a frame with an empty payload. */
const FRAME_OVERHEAD = 8;
const MIN_FRAME_LEN = 9;
const PAYLOAD_START = 7;
const LIVE_PAYLOAD_MIN = 6;
const RESULT_PAYLOAD_MIN = IMPEDANCE_OFFSET + 2;

/** Sum of the bytes from LEN up to (not including) the checksum byte, mod 256. */
export function checksum(frame: readonly number[]): number {
  let sum = 0;
  for (let i = HEADER.length; i < frame.length - 1; i += 1) sum += frame[i];
  return sum & 0xff;
}

export function encodeFrame(cmd: number, payload: readonly number[]): number[] {
  const frame = [...HEADER, payload.length + FRAME_OVERHEAD, 0x03, cmd, ...payload, 0];
  frame[frame.length - 1] = checksum(frame);
  return frame;
}

export function encodeHandshake(): number[] {
  return encodeFrame(CMD.HANDSHAKE, [0x02, 0x00, 0x00]);
}

export function encodeRequestResult(step: 1 | 2, userId: number): number[] {
  const payload = step === 1 ? [0x00, 0x02, 0x00] : [(userId >> 8) & 0xff, userId & 0xff, 0x00];
  return encodeFrame(CMD.REQUEST_RESULT, payload);
}

export function toHex(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type DecodedFrame =
  | { type: 'live'; weightKg: number; stable: boolean }
  | { type: 'result'; fresh: boolean; weightKg: number; impedanceOhm: number; hex: string }
  | { type: 'profile_ack' }
  | { type: 'status' }
  | { type: 'unknown' }
  | { type: 'malformed' };

function u16(payload: readonly number[], offset: number): number {
  return (payload[offset] << 8) | payload[offset + 1];
}

/** `frame` is a whole, checksum-valid frame. Never throws. */
export function decodeFrame(frame: readonly number[]): DecodedFrame {
  const cmd = frame[6];
  const payload = frame.slice(PAYLOAD_START, frame.length - 1);
  switch (cmd) {
    case CMD.LIVE:
      if (payload.length < LIVE_PAYLOAD_MIN) return { type: 'malformed' };
      return { type: 'live', weightKg: u16(payload, 0) / 10, stable: payload[5] === FLAG_STABLE };
    case CMD.RESULT: {
      if (payload.length < RESULT_PAYLOAD_MIN) return { type: 'malformed' };
      const kind = payload[0];
      if (kind !== KIND_FRESH && kind !== KIND_REPLAY) return { type: 'malformed' };
      return {
        type: 'result',
        fresh: kind === KIND_FRESH,
        weightKg: u16(payload, 3) / 10,
        impedanceOhm: u16(payload, IMPEDANCE_OFFSET),
        hex: toHex(frame),
      };
    }
    case CMD.PROFILE_ACK:
      return { type: 'profile_ack' };
    case CMD.STATUS:
      return { type: 'status' };
    default:
      return { type: 'unknown' };
  }
}

export interface FrameAssembler {
  push(bytes: readonly number[], nowMs: number): number[][];
}

function headerIndex(buffer: readonly number[]): number {
  for (let i = 0; i + HEADER.length <= buffer.length; i += 1) {
    if (HEADER.every((byte, offset) => buffer[i + offset] === byte)) return i;
  }
  return -1;
}

/** Length of the longest buffer suffix that could still become the start of a header. */
function partialHeaderLength(buffer: readonly number[]): number {
  for (let size = Math.min(HEADER.length - 1, buffer.length); size > 0; size -= 1) {
    const start = buffer.length - size;
    if (HEADER.slice(0, size).every((byte, offset) => buffer[start + offset] === byte)) return size;
  }
  return 0;
}

export function createFrameAssembler(): FrameAssembler {
  let buffer: number[] = [];
  let lastPushMs = 0;

  function drain(): number[][] {
    const frames: number[][] = [];
    for (;;) {
      const start = headerIndex(buffer);
      if (start === -1) {
        buffer = buffer.slice(buffer.length - partialHeaderLength(buffer));
        return frames;
      }
      buffer = buffer.slice(start);
      if (buffer.length <= HEADER.length) return frames;
      const len = buffer[HEADER.length];
      if (len < MIN_FRAME_LEN || len > MAX_FRAME_LEN) {
        buffer = buffer.slice(1);
        continue;
      }
      if (buffer.length < len) return frames;
      const candidate = buffer.slice(0, len);
      if (checksum(candidate) !== candidate[len - 1]) {
        buffer = buffer.slice(1);
        continue;
      }
      frames.push(candidate);
      buffer = buffer.slice(len);
    }
  }

  return {
    push(bytes, nowMs) {
      if (buffer.length > 0 && nowMs - lastPushMs > STALE_PARTIAL_MS) buffer = [];
      lastPushMs = nowMs;
      buffer = buffer.concat(bytes);
      return drain();
    },
  };
}
