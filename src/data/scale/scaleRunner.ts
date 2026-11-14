import type { BleReadingInput } from '@/data/body/bleReadings';
import {
  CONNECT_TIMEOUT_MS,
  HANDSHAKE_STEPS,
  HEALTH_HUB_USER_ID,
  RECONNECT_DELAY_MS,
  RESEND_PROFILE_AFTER_STABLE_MS,
  SCAN_TIMEOUT_MS,
  WRITE_GAP_MS,
} from '@/domain/scale/protocol';
import {
  createFrameAssembler,
  decodeFrame,
  encodeHandshake,
  encodeRequestResult,
} from '@/domain/scale/frameCodec';
import { encodeProfile, type ScaleProfileInput } from '@/domain/scale/scaleProfile';
import {
  INITIAL_SESSION,
  reduceScaleSession,
  type OffReason,
  type ScaleEffect,
  type ScaleEvent,
  type ScaleSession,
  type ScaleState,
} from '@/domain/scale/scaleSession';
import { matchesScale } from './discovery';
import type { ScaleTransport } from './ScaleTransport';

export interface ScaleRunnerDeps {
  transport: ScaleTransport;
  /** For measuredAt. */
  now: () => Date;
  /** For the frame assembler's stale-partial rule. */
  nowMs: () => number;
  loadProfile: () => Promise<ScaleProfileInput>;
  getRememberedId: () => Promise<string | null>;
  rememberId: (id: string) => Promise<void>;
  saveReading: (reading: BleReadingInput) => Promise<'saved' | 'duplicate'>;
  /** sync.notifyDataChanged */
  onSaved: () => void;
  /** Injected so tests do not wait. */
  delay: (ms: number) => Promise<void>;
}

export interface ScaleRunner {
  start(): void;
  stop(): void;
  retry(): void;
  /** The "Allow Bluetooth", "Open settings" and "Turn on Bluetooth" buttons all call this. */
  fixAndRetry(reason: OffReason): Promise<void>;
  subscribe(listener: () => void): () => void;
  getState(): ScaleState;
}

/**
 * Runs the pure session reducer against real Bluetooth. Every async step remembers the run it
 * belongs to; once `start`, `retry` or `stop` begins a newer run, late results are dropped.
 */
export function createScaleRunner(deps: ScaleRunnerDeps): ScaleRunner {
  const { transport } = deps;
  const listeners = new Set<() => void>();
  let session: ScaleSession = INITIAL_SESSION;
  let runId = 0;
  let peripheralId: string | null = null;
  /** Set when the permission request answered "Don't ask again"; Android then shows no dialog. */
  let permissionBlocked = false;
  let releaseConnection: () => void = () => undefined;

  function setSession(next: ScaleSession): void {
    const changed = next.ui !== session.ui;
    session = next;
    if (changed) listeners.forEach((listener) => listener());
  }

  function dispatch(id: number, event: ScaleEvent): void {
    if (id !== runId) return;
    const step = reduceScaleSession(session, event);
    setSession(step.session);
    step.effects.forEach((effect) => void perform(id, effect));
  }

  async function writeProfile(id: number): Promise<void> {
    const profile = await deps.loadProfile();
    if (id !== runId) return;
    await transport.write(encodeProfile(profile, HEALTH_HUB_USER_ID));
  }

  async function handshake(id: number): Promise<void> {
    for (const [index, step] of HANDSHAKE_STEPS.entries()) {
      if (index > 0) await deps.delay(WRITE_GAP_MS);
      if (id !== runId) return;
      if (step === 'handshake') {
        await transport.write(encodeHandshake());
      } else if (step === 'profile') {
        await writeProfile(id);
      } else {
        await transport.write(encodeRequestResult(1, HEALTH_HUB_USER_ID));
        await deps.delay(WRITE_GAP_MS);
        if (id !== runId) return;
        await transport.write(encodeRequestResult(2, HEALTH_HUB_USER_ID));
      }
    }
  }

  function listen(id: number): void {
    releaseConnection();
    const assembler = createFrameAssembler();
    let resendArmed = RESEND_PROFILE_AFTER_STABLE_MS !== null;
    const stopBytes = transport.onBytes((bytes) => {
      for (const raw of assembler.push(bytes, deps.nowMs())) {
        const frame = decodeFrame(raw);
        dispatch(id, { type: 'frame', frame, at: deps.now().toISOString() });
        if (resendArmed && frame.type === 'live' && frame.stable) {
          resendArmed = false;
          void resendProfile(id);
        }
      }
    });
    const stopDisconnected = transport.onDisconnected(() => dispatch(id, { type: 'disconnected' }));
    releaseConnection = () => {
      stopBytes();
      stopDisconnected();
      releaseConnection = () => undefined;
    };
  }

  async function resendProfile(id: number): Promise<void> {
    try {
      await deps.delay(RESEND_PROFILE_AFTER_STABLE_MS ?? 0);
      if (id === runId) await writeProfile(id);
    } catch {
      // A failed re-send surfaces as a missing result or a disconnect.
    }
  }

  async function scan(id: number): Promise<void> {
    const remembered = await deps.getRememberedId();
    if (id !== runId) return;
    const found = await transport.scan((p) => matchesScale(p, remembered), SCAN_TIMEOUT_MS);
    if (id !== runId) return;
    if (found === null) {
      dispatch(id, { type: 'scanTimedOut' });
      return;
    }
    peripheralId = found.id;
    dispatch(id, { type: 'found' });
  }

  async function connect(id: number): Promise<void> {
    if (peripheralId === null) {
      dispatch(id, { type: 'connectFailed' });
      return;
    }
    listen(id);
    const ok = await transport.connect(peripheralId, CONNECT_TIMEOUT_MS);
    if (id !== runId) {
      // Superseded while connecting: do not leave the new connection open.
      if (ok) await transport.disconnect();
      return;
    }
    dispatch(id, { type: ok ? 'connected' : 'connectFailed' });
  }

  /** The platform cannot tell "never asked" from "never ask again", so the runner remembers the answer. */
  async function preflight(): Promise<'ok' | OffReason> {
    const result = await transport.preflight();
    if (result !== 'permission_needed') permissionBlocked = false;
    return result === 'permission_needed' && permissionBlocked ? 'permission_blocked' : result;
  }

  async function save(id: number, effect: Extract<ScaleEffect, { type: 'save' }>): Promise<void> {
    const { reading } = effect;
    let outcome: 'saved' | 'duplicate' | 'failed';
    try {
      outcome = await deps.saveReading({ ...reading, deviceId: peripheralId ?? '' });
    } catch {
      outcome = 'failed';
    }
    // The data changed even if the run has since been superseded, so Body must still re-read.
    if (outcome === 'saved') deps.onSaved();
    dispatch(id, { type: 'saveDone', outcome, weightKg: reading.weightKg });
  }

  async function closeConnection(): Promise<void> {
    releaseConnection();
    if (peripheralId !== null) await transport.disconnect();
  }

  async function perform(id: number, effect: ScaleEffect): Promise<void> {
    try {
      switch (effect.type) {
        case 'preflight':
          return dispatch(id, { type: 'preflight', result: await preflight() });
        case 'scan':
          return await scan(id);
        case 'connect':
          return await connect(id);
        case 'handshake':
          return await handshake(id);
        case 'save':
          return await save(id, effect);
        case 'rememberDevice':
          if (peripheralId !== null) await deps.rememberId(peripheralId);
          return;
        case 'reconnect':
          releaseConnection();
          await deps.delay(RECONNECT_DELAY_MS);
          if (id === runId) await scan(id);
          return;
        case 'stopScan':
          return await transport.stopScan();
        case 'disconnect':
          return await closeConnection();
      }
    } catch {
      // The runner never throws: a failure shows up as the matching timeout or disconnect event.
      if (effect.type === 'preflight') dispatch(id, { type: 'preflight', result: 'bluetooth_off' });
      if (effect.type === 'scan' || effect.type === 'reconnect')
        dispatch(id, { type: 'scanFailed' });
      if (effect.type === 'connect') dispatch(id, { type: 'connectFailed' });
    }
  }

  /** Begins a new run: late results of the old one are dropped and its connection is closed. */
  function begin(event: ScaleEvent): void {
    const wasSearching = session.ui.kind === 'searching';
    runId += 1;
    // Stop the old scan first and without waiting: a late stopScan could cancel the new run's scan.
    if (wasSearching) void transport.stopScan().catch(() => undefined);
    void closeConnection().catch(() => undefined);
    peripheralId = null;
    dispatch(runId, event);
  }

  return {
    start: () => begin({ type: 'foreground' }),
    retry: () => begin({ type: 'retry' }),
    stop() {
      dispatch(runId, { type: 'background' });
      runId += 1;
    },
    async fixAndRetry(reason) {
      try {
        if (reason === 'permission_needed') {
          permissionBlocked = (await transport.requestPermissions()) === 'blocked';
        } else if (reason === 'permission_blocked') await transport.openSettings();
        else if (reason === 'bluetooth_off') await transport.enableBluetooth();
      } catch {
        // Whatever went wrong, the preflight below reports the real state.
      }
      begin({ type: 'retry' });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getState: () => session.ui,
  };
}
