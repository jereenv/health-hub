import { syntheticWeek } from './__fixtures__/synthetic';
import { setup } from './__fixtures__/views';
import { buildHeartRateSection, heartRateWeeklyColumns } from './heartRateSection';

function section(data = syntheticWeek()) {
  const { prep, view } = setup(data);
  return { prep, view, text: buildHeartRateSection(prep, view) };
}

test('lowest 50, highest 150, mean of daily averages 68 over 4 completed days; today (160 max) excluded', () => {
  expect(section().text.summary).toContain(
    '- Heart rate (daily min / avg / max only; no resting heart rate is available): lowest 50 bpm, highest 150 bpm, mean of daily averages 68 bpm over 4 completed days with data (2 days without data skipped); previous period mean of daily averages 69 bpm (2 days; lowest 52, highest 138).',
  );
});

test('the line says there is no resting heart rate', () => {
  const { text } = section();
  expect(text.summary.join('\n')).toContain('no resting heart rate is available');
  expect(text.context[0]).toBe(
    '- Heart rate: daily minimum, average and maximum only. No resting or asleep heart rate is available.',
  );
});

test('no heart-rate rows prints "no data in this period"', () => {
  const data = syntheticWeek();
  data.heartRate = [];
  expect(section(data).text.summary).toEqual([
    '### Heart rate',
    '- Heart rate: no data in this period.',
  ]);
});

test('weekly column: the week of Nov 9 uses completed days only', () => {
  const { prep, view } = section();
  // Nov 10 (70) and Nov 11 (67); Nov 12 (72, today) is left out.
  expect(heartRateWeeklyColumns(prep, view).byWeek.get('2026-11-09')).toEqual(['69']);
});
