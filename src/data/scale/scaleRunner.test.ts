import { buildFrame, liveFrame, resultFrame, split } from '@/domain/scale/__fixtures__/frames';
import { encodeHandshake, toHex } from '@/domain/scale/frameCodec';
import { encodeProfile, type ScaleProfileInput } from '@/domain/scale/scaleProfile';
import {
  HEALTH_HUB_USER_ID,
  KIND_FRESH,
  KIND_REPLAY,
  MAX_SCAN_WINDOWS,
} from '@/domain/scale/protocol';
import type { OffReason } from '@/domain/scale/scaleSession';
import { createScaleRunner, type ScaleRunnerDeps } from './scaleRunner';
import type { PermissionResult, ScalePeripheral, ScaleTransport } from './ScaleTransport';

const PROFILE: ScaleProfileInput = {
  sex: 'male',
  heightCm: 175,
  birthDate: '1996-01-01',
  lastWeightKg: 80,
  today: '2026-11-13',
};

class FakeTransport implements ScaleTransport {
  preflightResult: 'ok' | OffReason = 'ok';
  scanResult: ScalePeripheral | null = { id: 'dev-1', name: 'IF_B2A' };
  scanGate: Promise<void> | null = null;
  connectResult = true;
  writes: number[][] = [];
  calls: string[] = [];
  scanMatchers: ((p: ScalePeripheral) => boolean)[] = [];
  private bytesListeners = new Set<(bytes: number[]) => void>();
  private disconnectListeners = new Set<() => void>();

  async preflight() {
    this.calls.push('preflight');
    return this.preflightResult;
  }
  async requestPermissions(): Promise<PermissionResult> {
    this.calls.push('requestPermissions');
    return 'granted';
  }
  async enableBluetooth() {
    this.calls.push('enableBluetooth');
    this.preflightResult = 'ok';
    return true;
  }
  async openSettings() {
    this.calls.push('openSettings');
  }
  async scan(match: (p: ScalePeripheral) => boolean) {
    this.calls.push('scan');
    this.scanMatchers.push(match);
    if (this.scanGate) await this.scanGate;
    return this.scanResult;
  }
  async stopScan() {
    this.calls.push('stopScan');
  }
  async connect() {
    this.calls.push('connect');
    return this.connectResult;
  }
  async write(bytes: readonly number[]) {
    this.writes.push([...bytes]);
  }
  async disconnect() {
    this.calls.push('disconnect');
  }
  onBytes(listener: (bytes: number[]) => void) {
    this.bytesListeners.add(listener);
    return () => void this.bytesListeners.delete(listener);
  }
  onDisconnected(listener: () => void) {
    this.disconnectListeners.add(listener);
    return () => void this.disconnectListeners.delete(listener);
  }
  push(bytes: number[]) {
    this.bytesListeners.forEach((listener) => listener(bytes));
  }
  fireDisconnect() {
    this.disconnectListeners.forEach((listener) => listener());
  }
  count(call: string) {
    return this.calls.filter((entry) => entry === call).length;
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 400; i += 1) await Promise.resolve();
}

function setup(configure: (transport: FakeTransport) => void = () => undefined) {
  const transport = new FakeTransport();
  configure(transport);
  let remembered: string | null = null;
  const saveReading = jest.fn<
    ReturnType<ScaleRunnerDeps['saveReading']>,
    Parameters<ScaleRunnerDeps['saveReading']>
  >(async () => 'saved');
  const onSaved = jest.fn();
  const rememberId = jest.fn(async (id: string) => {
    remembered = id;
  });
  const runner = createScaleRunner({
    transport,
    now: () => new Date('2026-11-13T12:00:00.000Z'),
    nowMs: () => 0,
    loadProfile: async () => PROFILE,
    getRememberedId: async () => remembered,
    rememberId,
    saveReading,
    onSaved,
    delay: async () => undefined,
  });
  return { transport, runner, saveReading, onSaved, rememberId };
}

const freshFrame = () => resultFrame({ kind: KIND_FRESH, kg10: 805, impedance: 500 });

async function startConnected(configure?: (transport: FakeTransport) => void) {
  const parts = setup(configure);
  parts.runner.start();
  await flush();
  return parts;
}

test('start runs preflight, scan, connect, handshake in order', async () => {
  const { transport, runner } = await startConnected();
  expect(transport.calls.slice(0, 3)).toEqual(['preflight', 'scan', 'connect']);
  expect(transport.writes).toEqual([encodeHandshake(), encodeProfile(PROFILE, HEALTH_HUB_USER_ID)]);
  expect(runner.getState()).toEqual({ kind: 'waiting' });
});

test('a weigh-in saves once and calls onSaved', async () => {
  const { transport, runner, saveReading, onSaved } = await startConnected();
  transport.push(liveFrame(805, true));
  const [head, tail] = split(freshFrame(), 20);
  for (let i = 0; i < 3; i += 1) {
    transport.push(head);
    transport.push(tail);
    await flush();
  }
  expect(saveReading).toHaveBeenCalledTimes(1);
  expect(saveReading).toHaveBeenCalledWith({
    weightKg: 80.5,
    impedanceOhm: 500,
    rawPayload: toHex(freshFrame()),
    measuredAt: '2026-11-13T12:00:00.000Z',
    deviceId: 'dev-1',
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(runner.getState()).toEqual({ kind: 'saved', weightKg: 80.5 });
});

test('a replay after connect is never saved', async () => {
  const { transport, runner, saveReading, onSaved } = await startConnected();
  transport.push(resultFrame({ kind: KIND_REPLAY, kg10: 805, impedance: 500 }));
  await flush();
  expect(saveReading).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(runner.getState()).toEqual({ kind: 'waiting' });
});

test('stop disconnects, stops the scan and goes idle; a late scan result is ignored', async () => {
  let release: () => void = () => undefined;
  const { transport, runner } = setup((t) => {
    t.scanGate = new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  runner.start();
  await flush();
  expect(runner.getState()).toEqual({ kind: 'searching' });
  runner.stop();
  await flush();
  expect(runner.getState()).toEqual({ kind: 'idle' });
  expect(transport.calls).toContain('stopScan');
  release();
  await flush();
  expect(runner.getState()).toEqual({ kind: 'idle' });
  expect(transport.calls).not.toContain('connect');
});

test('stop after connecting disconnects the scale', async () => {
  const { transport, runner } = await startConnected();
  runner.stop();
  await flush();
  expect(transport.count('disconnect')).toBe(1);
  expect(runner.getState()).toEqual({ kind: 'idle' });
});

test('start after stop begins a fresh run', async () => {
  const { transport, runner } = await startConnected();
  runner.stop();
  await flush();
  runner.start();
  await flush();
  expect(runner.getState()).toEqual({ kind: 'waiting' });
  expect(transport.count('connect')).toBe(2);
  expect(transport.writes).toHaveLength(4);
});

test('scan windows repeat, then not_found, and retry scans again', async () => {
  const { transport, runner } = await startConnected((t) => {
    t.scanResult = null;
  });
  expect(transport.count('scan')).toBe(MAX_SCAN_WINDOWS);
  expect(runner.getState()).toEqual({ kind: 'error', error: 'not_found' });
  runner.retry();
  await flush();
  expect(transport.count('scan')).toBe(MAX_SCAN_WINDOWS * 2);
});

test('Bluetooth off then fixAndRetry calls enableBluetooth and restarts', async () => {
  const { transport, runner } = await startConnected((t) => {
    t.preflightResult = 'bluetooth_off';
  });
  expect(runner.getState()).toEqual({ kind: 'off', reason: 'bluetooth_off' });
  await runner.fixAndRetry('bluetooth_off');
  await flush();
  expect(transport.count('enableBluetooth')).toBe(1);
  expect(runner.getState()).toEqual({ kind: 'waiting' });
});

test.each([
  ['permission_needed' as const, 'requestPermissions'],
  ['permission_blocked' as const, 'openSettings'],
])('%s runs %s and then the preflight again', async (reason, call) => {
  const { transport, runner } = await startConnected((t) => {
    t.preflightResult = reason;
  });
  expect(runner.getState()).toEqual({ kind: 'off', reason });
  await runner.fixAndRetry(reason);
  await flush();
  expect(transport.count(call)).toBe(1);
  expect(transport.count('preflight')).toBe(2);
});

test('the device id is remembered on the first frame', async () => {
  const { transport, rememberId } = await startConnected();
  expect(rememberId).not.toHaveBeenCalled();
  transport.push(buildFrame(0x8d, [0x31, 0x02, 0x64, 0x00, 0x02, 0x00, 0x00]));
  await flush();
  expect(rememberId).toHaveBeenCalledWith('dev-1');
});

test('with RESEND_PROFILE_AFTER_STABLE_MS null no profile is re-sent', async () => {
  const { transport } = await startConnected();
  const before = transport.writes.length;
  transport.push(liveFrame(805, false));
  transport.push(liveFrame(805, true));
  await flush();
  expect(transport.writes).toHaveLength(before);
});

test('a disconnect before a save reconnects', async () => {
  const { transport, runner } = await startConnected();
  transport.fireDisconnect();
  await flush();
  expect(transport.count('connect')).toBe(2);
  expect(runner.getState()).toEqual({ kind: 'waiting' });
});
