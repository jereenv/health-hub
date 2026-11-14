import { liveFrame, resultFrame } from './__fixtures__/frames';
import { decodeFrame, toHex, type DecodedFrame } from './frameCodec';
import { KIND_FRESH, KIND_REPLAY, MAX_SCAN_WINDOWS } from './protocol';
import {
  INITIAL_SESSION,
  reduceScaleSession,
  type OffReason,
  type ScaleEffect,
  type ScaleEvent,
  type ScaleSession,
} from './scaleSession';

function run(events: ScaleEvent[], from: ScaleSession = INITIAL_SESSION) {
  let session = from;
  const effects: ScaleEffect[] = [];
  for (const event of events) {
    const step = reduceScaleSession(session, event);
    session = step.session;
    effects.push(...step.effects);
  }
  return { session, effects };
}

const NOW = '2026-11-13T12:00:00.000Z';
const decode = (frame: number[]): DecodedFrame => decodeFrame(frame);
const frameEvent = (frame: number[], at = NOW): ScaleEvent => ({
  type: 'frame',
  frame: decode(frame),
  at,
});
const live = (stable: boolean) => frameEvent(liveFrame(805, stable));
const freshFrame = (kg10 = 805, impedance = 500) =>
  resultFrame({ kind: KIND_FRESH, kg10, impedance });
const fresh = (kg10 = 805, impedance = 500, at = NOW) =>
  frameEvent(freshFrame(kg10, impedance), at);
const saves = (effects: ScaleEffect[]) => effects.filter((effect) => effect.type === 'save');

const toConnected: ScaleEvent[] = [
  { type: 'foreground' },
  { type: 'preflight', result: 'ok' },
  { type: 'found' },
  { type: 'connected' },
];

describe('startup', () => {
  test('foreground starts a preflight and ok starts a scan', () => {
    const first = run([{ type: 'foreground' }]);
    expect(first.session.ui).toEqual({ kind: 'searching' });
    expect(first.session.foreground).toBe(true);
    expect(first.effects).toEqual([{ type: 'preflight' }]);
    const second = run([{ type: 'foreground' }, { type: 'preflight', result: 'ok' }]);
    expect(second.effects).toEqual([{ type: 'preflight' }, { type: 'scan' }]);
  });

  test.each<OffReason>(['unsupported', 'permission_needed', 'permission_blocked', 'bluetooth_off'])(
    'preflight %s shows off and does not scan',
    (reason) => {
      const { session, effects } = run([
        { type: 'foreground' },
        { type: 'preflight', result: reason },
      ]);
      expect(session.ui).toEqual({ kind: 'off', reason });
      expect(effects).not.toContainEqual({ type: 'scan' });
    },
  );

  test('retry from off or error starts over', () => {
    const off = run([
      { type: 'foreground' },
      { type: 'preflight', result: 'bluetooth_off' },
      { type: 'retry' },
    ]);
    expect(off.session.ui).toEqual({ kind: 'searching' });
    expect(off.effects.filter((effect) => effect.type === 'preflight')).toHaveLength(2);

    const reconnect: ScaleEvent[] = [
      { type: 'disconnected' },
      { type: 'found' },
      { type: 'connected' },
    ];
    const lost = run([...toConnected, ...reconnect, ...reconnect, { type: 'disconnected' }]);
    expect(lost.session.ui).toEqual({ kind: 'error', error: 'connection_lost' });
    const again = run([{ type: 'retry' }], lost.session);
    expect(again.session).toMatchObject({
      ui: { kind: 'searching' },
      reconnects: 0,
      scanWindows: 0,
    });
    expect(again.effects).toEqual([{ type: 'preflight' }]);
  });

  test('found connects, connected sends the handshake', () => {
    const { session, effects } = run(toConnected);
    expect(session.ui).toEqual({ kind: 'waiting' });
    expect(effects).toEqual([
      { type: 'preflight' },
      { type: 'scan' },
      { type: 'connect' },
      { type: 'handshake' },
    ]);
  });

  test('connectFailed shows connect_failed', () => {
    const { session } = run([
      { type: 'foreground' },
      { type: 'preflight', result: 'ok' },
      { type: 'found' },
      { type: 'connectFailed' },
    ]);
    expect(session.ui).toEqual({ kind: 'error', error: 'connect_failed' });
  });
});

describe('scan windows', () => {
  const searching: ScaleEvent[] = [{ type: 'foreground' }, { type: 'preflight', result: 'ok' }];

  test('a scan window that ends re-scans until MAX_SCAN_WINDOWS, then shows not_found', () => {
    const timeouts = (count: number): ScaleEvent[] =>
      Array.from({ length: count }, (): ScaleEvent => ({ type: 'scanTimedOut' }));
    const before = run([...searching, ...timeouts(MAX_SCAN_WINDOWS - 1)]);
    expect(before.session.ui).toEqual({ kind: 'searching' });
    expect(before.effects.filter((effect) => effect.type === 'scan')).toHaveLength(
      MAX_SCAN_WINDOWS,
    );
    const last = run([...searching, ...timeouts(MAX_SCAN_WINDOWS)]);
    expect(last.session.ui).toEqual({ kind: 'error', error: 'not_found' });
    expect(last.effects.filter((effect) => effect.type === 'scan')).toHaveLength(MAX_SCAN_WINDOWS);
  });

  test('found resets the scan window count', () => {
    const { session } = run([
      ...searching,
      { type: 'scanTimedOut' },
      { type: 'scanTimedOut' },
      { type: 'found' },
    ]);
    expect(session.scanWindows).toBe(0);
  });
});

describe('results', () => {
  test('a replay result neither saves nor changes the card', () => {
    const replay = frameEvent(resultFrame({ kind: KIND_REPLAY, kg10: 805, impedance: 500 }));
    const { session, effects } = run([...toConnected, replay]);
    expect(saves(effects)).toHaveLength(0);
    expect(session.ui).toEqual({ kind: 'waiting' });
    expect(session.savedKey).toBeNull();
  });

  test('a fresh result saves once and the 3 s repeats are suppressed', () => {
    const { effects } = run([...toConnected, fresh(), fresh(), fresh()]);
    expect(saves(effects)).toEqual([
      {
        type: 'save',
        reading: {
          weightKg: 80.5,
          impedanceOhm: 500,
          rawPayload: toHex(freshFrame()),
          measuredAt: NOW,
        },
      },
    ]);
  });

  test('a second, different fresh result in one connection is saved', () => {
    const { effects } = run([...toConnected, fresh(805, 500), fresh(803, 498)]);
    expect(saves(effects)).toHaveLength(2);
  });

  test('a settling live frame re-arms saving of an identical result', () => {
    const { effects } = run([
      ...toConnected,
      fresh(),
      { type: 'saveDone', outcome: 'saved', weightKg: 80.5 },
      live(false),
      fresh(),
    ]);
    expect(saves(effects)).toHaveLength(2);
  });

  test('impedance 0 is saved as null', () => {
    const { effects } = run([...toConnected, fresh(805, 0)]);
    expect(saves(effects)[0]).toMatchObject({ reading: { impedanceOhm: null } });
  });

  test.each([199, 4001])('weight %i (kg x10) outside 20 to 400 kg is never saved', (kg10) => {
    expect(saves(run([...toConnected, fresh(kg10)]).effects)).toHaveLength(0);
  });
});

describe('card', () => {
  test('live frames drive the card: settling then stable', () => {
    expect(run([...toConnected, live(false)]).session.ui).toEqual({
      kind: 'live',
      weightKg: 80.5,
      stable: false,
    });
    expect(run([...toConnected, live(false), live(true)]).session.ui).toEqual({
      kind: 'live',
      weightKg: 80.5,
      stable: true,
    });
  });

  test('a stable live frame after saved keeps the card on saved', () => {
    const { session } = run([
      ...toConnected,
      fresh(),
      { type: 'saveDone', outcome: 'saved', weightKg: 80.5 },
      live(true),
    ]);
    expect(session.ui).toEqual({ kind: 'saved', weightKg: 80.5 });
  });

  test('saveDone duplicate shows saved', () => {
    const { session } = run([
      ...toConnected,
      fresh(),
      { type: 'saveDone', outcome: 'duplicate', weightKg: 80.5 },
    ]);
    expect(session.ui).toEqual({ kind: 'saved', weightKg: 80.5 });
  });

  test('saveDone failed shows error save_failed', () => {
    const { session } = run([
      ...toConnected,
      fresh(),
      { type: 'saveDone', outcome: 'failed', weightKg: 80.5 },
    ]);
    expect(session.ui).toEqual({ kind: 'error', error: 'save_failed' });
  });

  test('unknown, malformed, status and ack frames change nothing', () => {
    const before = run([...toConnected, live(false)]);
    const types: DecodedFrame[] = [
      { type: 'unknown' },
      { type: 'malformed' },
      { type: 'status' },
      { type: 'profile_ack' },
    ];
    for (const frame of types) {
      const after = run([{ type: 'frame', frame, at: NOW }], before.session);
      expect(after.session).toEqual(before.session);
      expect(after.effects).toEqual([]);
    }
  });

  test('rememberDevice is emitted once, on the first frame', () => {
    const { effects } = run([
      ...toConnected,
      frameEvent(liveFrame(805, false)),
      live(true),
      fresh(),
    ]);
    expect(effects.filter((effect) => effect.type === 'rememberDevice')).toHaveLength(1);
    const status = run([...toConnected, { type: 'frame', frame: { type: 'status' }, at: NOW }]);
    expect(status.effects).toContainEqual({ type: 'rememberDevice' });
  });
});

describe('disconnects and background', () => {
  test('a disconnect before a save retries twice then gives up', () => {
    const disconnected: ScaleEvent = { type: 'disconnected' };
    const first = run([...toConnected, disconnected]);
    expect(first.session).toMatchObject({ ui: { kind: 'searching' }, reconnects: 1 });
    expect(first.effects.filter((effect) => effect.type === 'reconnect')).toHaveLength(1);

    const second = run([{ type: 'found' }, { type: 'connected' }, disconnected], first.session);
    expect(second.session).toMatchObject({ ui: { kind: 'searching' }, reconnects: 2 });

    const third = run([{ type: 'found' }, { type: 'connected' }, disconnected], second.session);
    expect(third.session.ui).toEqual({ kind: 'error', error: 'connection_lost' });
    expect(third.effects).not.toContainEqual({ type: 'reconnect' });
  });

  test('a disconnect after saved changes nothing', () => {
    const saved = run([
      ...toConnected,
      fresh(),
      { type: 'saveDone', outcome: 'saved', weightKg: 80.5 },
    ]);
    const after = run([{ type: 'disconnected' }], saved.session);
    expect(after.session).toEqual(saved.session);
    expect(after.effects).toEqual([]);
  });

  test('background stops the scan, disconnects and goes idle, and late frames are ignored', () => {
    const connected = run(toConnected);
    const after = run([{ type: 'background' }], connected.session);
    expect(after.session).toMatchObject({ ui: { kind: 'idle' }, foreground: false });
    expect(after.effects).toEqual([{ type: 'stopScan' }, { type: 'disconnect' }]);

    const late = run(
      [live(true), fresh(), { type: 'disconnected' }, { type: 'found' }],
      after.session,
    );
    expect(late.session).toEqual(after.session);
    expect(late.effects).toEqual([]);
  });

  test('a new foreground after background starts a fresh run', () => {
    const { session } = run([
      ...toConnected,
      fresh(),
      { type: 'background' },
      { type: 'foreground' },
    ]);
    expect(session).toMatchObject({
      ui: { kind: 'searching' },
      savedKey: null,
      remembered: false,
      reconnects: 0,
    });
  });
});
