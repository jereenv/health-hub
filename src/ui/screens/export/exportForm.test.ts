import type { SectionId } from '@/domain/export/types';
import { DEFAULT_STARTER } from '@/domain/export/starterPrompts';

import {
  applyPickedDate,
  canShare,
  formReducer,
  initialForm,
  localDateKeyFromPicker,
  pickerDateFromKey,
  presetSubtitle,
  toRequest,
  visibleChips,
} from './exportForm';
import type { ExportForm } from './exportForm';

const TODAY = '2026-11-12';
const FIRST = '2026-05-03';
const bounds = { first: FIRST, today: TODAY };

const switchTo = (form: ExportForm, preset: ExportForm['preset']): ExportForm =>
  formReducer(form, { type: 'preset', preset, today: TODAY, firstDataDate: FIRST });

const allOff = (form: ExportForm, chips: SectionId[]): ExportForm =>
  chips.reduce((f, section) => formReducer(f, { type: 'toggleSection', section }), form);

test('initialForm is the weekly preset with all five sections on, the weekly starter, csv on and the latest workout selected', () => {
  const form = initialForm(42);
  expect(form.preset).toBe('week');
  expect(Object.values(form.sections)).toEqual([true, true, true, true, true]);
  expect(form.starter).toBe(DEFAULT_STARTER.week);
  expect(form.starterEdited).toBe(false);
  expect(form.includeCsv).toBe(true);
  expect(form.workoutId).toBe(42);
  expect(form.custom).toBeNull();
});

test('switching preset replaces the starter only when the owner has not edited it', () => {
  expect(switchTo(initialForm(1), 'month').starter).toBe(DEFAULT_STARTER.month);
  const edited = formReducer(initialForm(1), { type: 'starter', text: 'Why am I stuck?' });
  expect(switchTo(edited, 'month').starter).toBe('Why am I stuck?');
});

test('editing the starter marks it edited and a later preset switch keeps the text; clearing it leaves an empty starter', () => {
  const edited = formReducer(initialForm(1), { type: 'starter', text: 'Hello' });
  expect(edited.starterEdited).toBe(true);
  const cleared = formReducer(edited, { type: 'starter', text: '' });
  expect(cleared.starter).toBe('');
  expect(switchTo(cleared, 'journey').starter).toBe('');
});

test('toggleSection flips one section; toggleCsv flips csv', () => {
  const form = formReducer(initialForm(1), { type: 'toggleSection', section: 'sleep' });
  expect(form.sections).toEqual({
    body: true,
    workouts: true,
    activity: true,
    sleep: false,
    heartRate: true,
  });
  expect(formReducer(form, { type: 'toggleCsv' }).includeCsv).toBe(false);
});

test('visibleChips: week, month, custom show the five section chips; journey adds csv; workout shows body and sleep only', () => {
  const five = ['body', 'workouts', 'activity', 'sleep', 'heartRate'];
  expect(visibleChips('week')).toEqual(five);
  expect(visibleChips('month')).toEqual(five);
  expect(visibleChips('custom')).toEqual(five);
  expect(visibleChips('journey')).toEqual([...five, 'csv']);
  expect(visibleChips('workout')).toEqual(['body', 'sleep']);
});

test('canShare is false when every visible chip is off, and false for a single workout without a workout id', () => {
  const week = allOff(initialForm(1), ['body', 'workouts', 'activity', 'sleep', 'heartRate']);
  expect(canShare(week)).toBe(false);
  expect(canShare(initialForm(1))).toBe(true);
  expect(canShare(switchTo(initialForm(null), 'workout'))).toBe(false);
  expect(canShare(switchTo(initialForm(7), 'workout'))).toBe(true);
  const journeyCsvOnly = allOff(switchTo(initialForm(1), 'journey'), [
    'body',
    'workouts',
    'activity',
    'sleep',
    'heartRate',
  ]);
  expect(canShare(journeyCsvOnly)).toBe(false);
});

test('turning off a chip that is hidden for the current preset does not affect canShare', () => {
  const form = allOff(switchTo(initialForm(7), 'workout'), ['workouts', 'activity', 'heartRate']);
  expect(canShare(form)).toBe(true);
  // The workout itself is always in the briefing, so a chosen workout can be shared on its own.
  expect(canShare(allOff(form, ['body', 'sleep']))).toBe(true);
  expect(canShare(allOff(switchTo(initialForm(null), 'workout'), ['body', 'sleep']))).toBe(false);
});

test('toRequest passes the form through unchanged and drops csv for presets other than journey', () => {
  const form = initialForm(5);
  expect(toRequest(form)).toEqual({
    preset: 'week',
    sections: form.sections,
    starter: form.starter,
    workoutId: 5,
    custom: null,
    includeCsv: false,
  });
  expect(toRequest(switchTo(form, 'journey')).includeCsv).toBe(true);
  expect(toRequest(formReducer(switchTo(form, 'journey'), { type: 'toggleCsv' })).includeCsv).toBe(
    false,
  );
});

test('selecting custom without a range seeds it to the last 14 days, clamped to the first data date', () => {
  expect(switchTo(initialForm(1), 'custom').custom).toEqual({ from: '2026-10-30', to: TODAY });
  const young = formReducer(initialForm(1), {
    type: 'preset',
    preset: 'custom',
    today: TODAY,
    firstDataDate: '2026-11-05',
  });
  expect(young.custom).toEqual({ from: '2026-11-05', to: TODAY });
  const chosen = formReducer(switchTo(initialForm(1), 'custom'), {
    type: 'customRange',
    window: { from: '2026-10-01', to: '2026-10-10' },
  });
  expect(switchTo(switchTo(chosen, 'week'), 'custom').custom).toEqual({
    from: '2026-10-01',
    to: '2026-10-10',
  });
});

test('applyPickedDate clamps To to today and From to the first data date', () => {
  const window = { from: '2026-10-01', to: '2026-10-10' };
  expect(applyPickedDate(window, 'to', '2026-12-25', bounds)).toEqual({
    from: '2026-10-01',
    to: TODAY,
  });
  expect(applyPickedDate(window, 'from', '2026-01-01', bounds)).toEqual({
    from: FIRST,
    to: '2026-10-10',
  });
});

test('picking a From after To moves To to the same day; picking a To before From moves From to the same day', () => {
  const window = { from: '2026-10-01', to: '2026-10-10' };
  expect(applyPickedDate(window, 'from', '2026-10-20', bounds)).toEqual({
    from: '2026-10-20',
    to: '2026-10-20',
  });
  expect(applyPickedDate(window, 'to', '2026-09-20', bounds)).toEqual({
    from: '2026-09-20',
    to: '2026-09-20',
  });
});

test('picking a valid From or To changes only that edge', () => {
  const window = { from: '2026-10-01', to: '2026-10-10' };
  expect(applyPickedDate(window, 'from', '2026-10-05', bounds)).toEqual({
    from: '2026-10-05',
    to: '2026-10-10',
  });
  expect(applyPickedDate(window, 'to', '2026-10-08', bounds)).toEqual({
    from: '2026-10-01',
    to: '2026-10-08',
  });
});

test('localDateKeyFromPicker returns the local calendar day, including a picked day near midnight and across 2026-11-01', () => {
  expect(localDateKeyFromPicker(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
  expect(localDateKeyFromPicker(new Date(2026, 10, 1, 0, 1))).toBe('2026-11-01');
  expect(localDateKeyFromPicker(new Date(2026, 10, 2, 0, 0))).toBe('2026-11-02');
  expect(localDateKeyFromPicker(pickerDateFromKey('2026-11-01'))).toBe('2026-11-01');
});

test('presetSubtitle: weekly, month, journey ("Weekly averages since May 2026, plus a CSV"), workout with and without a choice, custom with and without a range', () => {
  const base = { workoutLabel: null, firstDataDate: FIRST, today: TODAY, custom: null };
  expect(presetSubtitle('week', base)).toBe('Last 7 days vs the week before');
  expect(presetSubtitle('month', base)).toBe('Last 30 days');
  expect(presetSubtitle('journey', base)).toBe('Weekly averages since May 2026, plus a CSV');
  expect(presetSubtitle('workout', base)).toBe("Every set, plus that day's body and sleep");
  expect(presetSubtitle('workout', { ...base, workoutLabel: 'Pull · Wed 11 Nov' })).toBe(
    'Pull · Wed 11 Nov',
  );
  expect(presetSubtitle('custom', base)).toBe('Pick dates and sections');
  expect(
    presetSubtitle('custom', { ...base, custom: { from: '2026-10-01', to: '2026-10-10' } }),
  ).toBe('1 Oct – 10 Oct');
  expect(
    presetSubtitle('custom', { ...base, custom: { from: '2025-12-20', to: '2026-01-10' } }),
  ).toBe('20 Dec 2025 – 10 Jan 2026');
});
