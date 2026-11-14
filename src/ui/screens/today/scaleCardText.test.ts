import type { OffReason, ScaleErrorKind, ScaleState } from '@/domain/scale/scaleSession';

import { buildScaleCardModel } from './scaleCardText';

const OFF_CASES: [OffReason, string, string | null, string | null][] = [
  ['permission_needed', 'Bluetooth permission needed', 'Allow Bluetooth', 'allow'],
  ['permission_blocked', 'Bluetooth permission is off', 'Open settings', 'settings'],
  ['bluetooth_off', 'Bluetooth is off', 'Turn on Bluetooth', 'bluetooth'],
  ['unsupported', "This phone can't connect to the scale", null, null],
];

const ERROR_CASES: [ScaleErrorKind, string][] = [
  ['not_found', "Can't find the scale"],
  ['connect_failed', "Couldn't connect to the scale"],
  ['connection_lost', 'Connection lost'],
  ['save_failed', "Couldn't save the weigh-in"],
];

describe.each(['kg', 'lb'] as const)('buildScaleCardModel in %s', (unit) => {
  test('idle renders nothing', () => {
    expect(buildScaleCardModel({ kind: 'idle' }, unit)).toBeNull();
  });

  test.each(['searching', 'connecting'] as const)('%s looks for the scale', (kind) => {
    expect(buildScaleCardModel({ kind }, unit)).toEqual({
      title: 'Looking for the scale',
      subtitle: 'Step on it to wake it up',
      weightText: null,
      action: null,
      secondary: null,
    });
  });

  test('waiting asks for a step', () => {
    const model = buildScaleCardModel({ kind: 'waiting' }, unit);
    expect(model?.title).toBe('Step on the scale');
    expect(model?.action).toBeNull();
  });

  test('live shows the weight with Settling… or Stay on', () => {
    const expected = unit === 'kg' ? '80.5 kg' : '177.5 lb';
    const stable = buildScaleCardModel({ kind: 'live', weightKg: 80.5, stable: true }, unit);
    const settling = buildScaleCardModel({ kind: 'live', weightKg: 80.5, stable: false }, unit);
    expect(stable).toMatchObject({
      weightText: expected,
      subtitle: 'Stay on · measuring body composition',
    });
    expect(settling).toMatchObject({ weightText: expected, subtitle: 'Settling…' });
  });

  test('saved offers See in Body and Weigh again', () => {
    expect(buildScaleCardModel({ kind: 'saved', weightKg: 80.5 }, unit)).toMatchObject({
      title: 'Saved',
      weightText: unit === 'kg' ? '80.5 kg' : '177.5 lb',
      action: { label: 'See in Body', kind: 'body' },
      secondary: { label: 'Weigh again', kind: 'retry' },
    });
  });

  test.each(OFF_CASES)('off/%s', (reason, title, label, kind) => {
    const model = buildScaleCardModel({ kind: 'off', reason }, unit);
    expect(model?.title).toBe(title);
    expect(model?.weightText).toBeNull();
    expect(model?.action).toEqual(label === null ? null : { label, kind });
  });

  test.each(ERROR_CASES)('error/%s has one Try again action and no weight', (error, title) => {
    const state: ScaleState = { kind: 'error', error };
    const model = buildScaleCardModel(state, unit);
    expect(model).toMatchObject({
      title,
      weightText: null,
      action: { label: 'Try again', kind: 'retry' },
      secondary: null,
    });
  });
});
