import { buildFrame, liveFrame, resultFrame, split } from './__fixtures__/frames';
import {
  checksum,
  createFrameAssembler,
  decodeFrame,
  encodeFrame,
  encodeHandshake,
  encodeRequestResult,
  toHex,
} from './frameCodec';
import { CMD, KIND_FRESH, KIND_REPLAY } from './protocol';

const fresh = (impedance = 500) => resultFrame({ kind: KIND_FRESH, kg10: 805, impedance });

describe('encoding', () => {
  test('encodeHandshake matches the documented bytes', () => {
    expect(encodeHandshake()).toEqual([
      0x10, 0x00, 0x00, 0xc5, 0x0b, 0x03, 0x0d, 0x02, 0x00, 0x00, 0x1d,
    ]);
  });

  test('encodeFrame agrees with the independent test builder', () => {
    expect(encodeFrame(0x82, new Array<number>(23).fill(0))).toEqual(
      buildFrame(0x82, new Array<number>(23).fill(0)),
    );
  });

  test('checksum sums LEN up to the byte before CS', () => {
    expect(checksum(encodeHandshake())).toBe(0x1d);
  });

  test('encodeRequestResult writes the two documented payloads', () => {
    expect(encodeRequestResult(1, 0x4801).slice(7, 10)).toEqual([0x00, 0x02, 0x00]);
    expect(encodeRequestResult(2, 0x4801).slice(7, 10)).toEqual([0x48, 0x01, 0x00]);
  });
});

describe('frame lengths', () => {
  test.each([
    ['live', liveFrame(800, true), 0x0e],
    ['result', fresh(), 0x1f],
    ['handshake', encodeHandshake(), 0x0b],
    ['profile', encodeFrame(CMD.PROFILE, new Array<number>(11).fill(0)), 0x13],
    ['status', buildFrame(0x8d, [0x31, 0x02, 0x64, 0x00, 0x02, 0x00, 0x00]), 0x0f],
  ])('%s has LEN %i', (_name, frame, len) => {
    expect(frame[4]).toBe(len);
    expect(frame).toHaveLength(len);
  });
});

describe('decodeFrame', () => {
  test('decodes live weight and flag', () => {
    expect(decodeFrame(liveFrame(800, true))).toEqual({ type: 'live', weightKg: 80, stable: true });
    expect(decodeFrame(liveFrame(800, false))).toEqual({
      type: 'live',
      weightKg: 80,
      stable: false,
    });
    expect(decodeFrame(buildFrame(0x80, [0x03, 0x20, 0, 0, 1, 0x55]))).toEqual({
      type: 'live',
      weightKg: 80,
      stable: false,
    });
  });

  test('decodes a fresh result with impedance at offset 9', () => {
    const frame = resultFrame({
      kind: KIND_FRESH,
      kg10: 805,
      impedance: 500,
      offset5: 321,
      offset7: 654,
    });
    expect(decodeFrame(frame)).toEqual({
      type: 'result',
      fresh: true,
      weightKg: 80.5,
      impedanceOhm: 500,
      hex: toHex(frame),
    });
  });

  test('a 0xFF result is a replay', () => {
    const decoded = decodeFrame(resultFrame({ kind: KIND_REPLAY, kg10: 805, impedance: 500 }));
    expect(decoded).toMatchObject({ type: 'result', fresh: false });
  });

  test('an unknown result kind is malformed', () => {
    expect(decodeFrame(resultFrame({ kind: 0x07, kg10: 805, impedance: 500 }))).toEqual({
      type: 'malformed',
    });
  });

  test.each([
    ['short live payload', buildFrame(0x80, [0x03, 0x20]), { type: 'malformed' }],
    [
      'short result payload',
      buildFrame(0x82, [0x00, 0x48, 0x48, 0x03, 0x25]),
      { type: 'malformed' },
    ],
    ['unknown cmd', buildFrame(0x99, [0x01]), { type: 'unknown' }],
    ['profile ack', buildFrame(0x81, [0x00, 0x48, 0x01]), { type: 'profile_ack' }],
    ['status', buildFrame(0x8d, [0x31, 0x02, 0x64, 0x00, 0x02, 0x00, 0x00]), { type: 'status' }],
  ])('%s', (_name, frame, expected) => {
    expect(decodeFrame(frame)).toEqual(expected);
  });
});

describe('createFrameAssembler', () => {
  const live = liveFrame(800, true);

  test('whole frame in one push', () => {
    expect(createFrameAssembler().push(live, 0)).toEqual([live]);
  });

  test('0x82 split 20 + 11', () => {
    const assembler = createFrameAssembler();
    const [head, tail] = split(fresh(), 20);
    expect(assembler.push(head, 0)).toEqual([]);
    expect(assembler.push(tail, 100)).toEqual([fresh()]);
  });

  test('two frames in one push', () => {
    const other = liveFrame(801, false);
    expect(createFrameAssembler().push([...live, ...other], 0)).toEqual([live, other]);
  });

  test('a frame split across three pushes', () => {
    const assembler = createFrameAssembler();
    expect(assembler.push(live.slice(0, 3), 0)).toEqual([]);
    expect(assembler.push(live.slice(3, 9), 10)).toEqual([]);
    expect(assembler.push(live.slice(9), 20)).toEqual([live]);
  });

  test('garbage before a header is dropped', () => {
    expect(createFrameAssembler().push([0x01, 0x02, 0x10, 0x55, ...live], 0)).toEqual([live]);
  });

  test('bad checksum is dropped and the next good frame still comes out', () => {
    const corrupt = [...live];
    corrupt[corrupt.length - 1] ^= 0xff;
    expect(createFrameAssembler().push([...corrupt, ...live], 0)).toEqual([live]);
  });

  test.each([4, 200])('header with LEN %i is skipped and resyncs', (len) => {
    const bad = [0x10, 0x00, 0x00, 0xc5, len, 0x03];
    expect(createFrameAssembler().push([...bad, ...live], 0)).toEqual([live]);
  });

  test('stale partial (1.5 s old) is discarded: a new whole frame arrives intact', () => {
    const assembler = createFrameAssembler();
    expect(assembler.push(fresh().slice(0, 20), 0)).toEqual([]);
    expect(assembler.push(live, 1_500)).toEqual([live]);
  });

  test('unknown cmd with valid checksum is emitted', () => {
    const unknown = buildFrame(0x99, [0x01, 0x02]);
    expect(createFrameAssembler().push(unknown, 0)).toEqual([unknown]);
  });

  test('empty push returns []', () => {
    expect(createFrameAssembler().push([], 0)).toEqual([]);
  });

  test('a 0x82 piece that is only the 11-byte tail with no header ahead of it is dropped', () => {
    const assembler = createFrameAssembler();
    const [, tail] = split(fresh(), 20);
    expect(assembler.push(tail, 0)).toEqual([]);
    expect(assembler.push(live, 10)).toEqual([live]);
  });

  test('a header split across two pushes is still found', () => {
    const assembler = createFrameAssembler();
    expect(assembler.push(live.slice(0, 2), 0)).toEqual([]);
    expect(assembler.push(live.slice(2), 10)).toEqual([live]);
  });
});
