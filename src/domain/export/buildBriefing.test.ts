import { expectGolden } from '@/test-support/golden';

import { SYNTHETIC_TODAY, syntheticJourney, syntheticWeek } from './__fixtures__/synthetic';
import { requestFor } from './__fixtures__/views';
import { buildBriefing, sectionsEnabled, sizeLabel } from './buildBriefing';
import type { Briefing } from './buildBriefing';
import { DEFAULT_STARTER } from './starterPrompts';
import type { ExportData, ExportRequest, PresetId, SectionId } from './types';

function brief(
  data: ExportData,
  preset: PresetId,
  unit: 'kg' | 'lb' = 'kg',
  extra: Partial<ExportRequest> = {},
): Briefing {
  return buildBriefing(data, requestFor(preset, { starter: DEFAULT_STARTER[preset], ...extra }), {
    today: SYNTHETIC_TODAY,
    unit,
  });
}

function emptyData(): ExportData {
  return {
    workouts: [],
    schedule: [],
    readings: [],
    versions: [],
    watch: [],
    activity: [],
    sleep: [],
    heartRate: [],
  };
}

const SECTIONS_OFF: Record<SectionId, boolean> = {
  body: false,
  workouts: false,
  activity: false,
  sleep: false,
  heartRate: false,
};

const BAD_TOKENS = /NaN|undefined|Infinity|\[object/;

describe('week, kg', () => {
  const b = brief(syntheticWeek(), 'week');

  test('golden', () => expectGolden('week-kg', b.markdown));

  test('headings, period and the key lines', () => {
    for (const text of [
      '# Weekly check-in · 6–12 Nov 2026',
      '> Review my week and suggest changes',
      '## Context',
      '## Summary',
      '## Detail',
      '- Period: Fri 6 Nov – Thu 12 Nov 2026 (7 days). Compared with Fri 30 Oct – Thu 5 Nov 2026.',
      '- Person: male, 31 years, 175 cm. Goal weight 75.0 kg.',
      '- Units: weights in kg, distances in km.',
      '- Weight (Measured, scale): 83.6 kg mean of 5 weigh-in days; previous period 84.7 kg (4 days); change −1.1 kg.',
      '- Workouts logged: 3 (previous period 1); volume 4.0 t (previous 1.1 t).',
      '- Steps: mean 8,000 per day over 5 completed days with data',
      '- Sleep: mean 6h 57m per night over 5 nights with data',
      'lowest 50 bpm, highest 150 bpm',
      'Body-composition formulas: Health Hub version 1',
      "### Body — daily (each day's first weigh-in)",
      '### Workouts',
      '### Activity, sleep and heart rate — daily',
    ]) {
      expect(b.markdown).toContain(text);
    }
  });

  test('the starter quote is the second block', () => {
    const blocks = b.markdown.split('\n\n');
    expect(blocks[0]).toBe('# Weekly check-in · 6–12 Nov 2026');
    expect(blocks[1]).toBe('> Review my week and suggest changes');
    expect(blocks[2]!.startsWith('## Context')).toBe(true);
  });

  test('active calories never appear', () => {
    expect(b.markdown).not.toMatch(/active calories/i);
  });

  test('the title, size and line count describe the text', () => {
    expect(b.title).toBe('Weekly check-in · 6–12 Nov 2026');
    expect(b.characters).toBe(b.markdown.length);
    expect(b.lineCount).toBe(b.markdown.trimEnd().split('\n').length);
    expect(b.csv).toBeNull();
    expect(b.csvFileName).toBeNull();
  });
});

test('week-lb golden: same data in lb and miles', () => {
  const b = brief(syntheticWeek(), 'week', 'lb');
  expectGolden('week-lb', b.markdown);
  expect(b.markdown).toContain('184.3 lb mean');
  expect(b.markdown).toContain('volume 8.9k lb');
  expect(b.markdown).toContain('Distance (mi)');
  expect(b.markdown).toContain('| Date | Weight (lb) |');
  expect(b.markdown).toContain('- Units: weights in lb, distances in mi.');
});

test('month golden: 30 days, medium detail', () => {
  const b = brief(syntheticWeek(), 'month');
  expectGolden('month', b.markdown);
  const bodyRows = b.markdown
    .split('\n')
    .filter((line) => /^\| \w{3} \d+ \w{3}\*? \|/.test(line) && line.split('|').length === 8);
  expect(bodyRows).toHaveLength(30);
  expect(b.markdown).toContain('| Week of | Sessions | Volume (kg) | Scheduled | Done |');
  expect(b.markdown).toContain('### Activity, sleep and heart rate — weekly');
  expect(b.markdown).not.toContain('- Bench Press:');
  expect(b.markdown).toContain('- Sat 7 Nov · Upper Strength · 58 min · 1.1 t');
});

describe('journey', () => {
  const b = brief(syntheticJourney(), 'journey', 'kg', { includeCsv: true });

  test('golden', () => {
    expectGolden('journey', b.markdown);
    expectGolden('journey.csv', b.csv as string);
  });

  test('weekly aggregates, last 14 days and no per-workout detail', () => {
    const lines = b.markdown.split('\n');
    const start = lines.indexOf('### Weekly aggregates');
    const end = lines.indexOf('### Last 14 days');
    expect(start).toBeGreaterThan(0);
    const weekRows = lines.slice(start + 3, end - 1).filter((l) => l.startsWith('| '));
    expect(weekRows).toHaveLength(18);
    expect(weekRows[17]).toContain('(to date)');
    expect(weekRows[0]!.startsWith('| 2026-07-13 |')).toBe(true);
    const after = lines.slice(end);
    expect(
      after.filter((l) => /^\| \w{3} \d+ Nov/.test(l) || /^\| \w{3} \d+ Oct/.test(l)),
    ).toHaveLength(28);
    expect(b.markdown).not.toContain('#### ');
    expect(b.markdown).not.toContain('- Bench Press:');
    expect(b.characters).toBeLessThan(20000);
  });

  test('comparison text says "journey start" and the Period line names both ends', () => {
    expect(b.markdown).toContain('journey start');
    expect(b.markdown).toContain(
      '- Period: Thu 16 Jul – Thu 12 Nov 2026 (120 days). Compared: first 7 days of the journey against the last 7 days (',
    );
    expect(b.markdown).not.toContain('previous period');
  });

  test('the CSV rides along and the size says so', () => {
    expect(b.csvFileName).toBe('health-hub-journey.csv');
    expect(b.csv).not.toBeNull();
    expect(sizeLabel(b)).toMatch(/^About [\d,]+ characters \+ CSV$/);
  });

  test('the CSV is left out when it is switched off or there is no data', () => {
    expect(brief(syntheticJourney(), 'journey').csv).toBeNull();
    expect(brief(emptyData(), 'journey', 'kg', { includeCsv: true }).csv).toBeNull();
  });
});

describe('custom', () => {
  test('custom-subset golden: workouts and heart rate off', () => {
    const b = brief(syntheticWeek(), 'custom', 'kg', {
      custom: { from: '2026-11-09', to: '2026-11-11' },
      sections: { ...SECTIONS_OFF, body: true, activity: true, sleep: true },
    });
    expectGolden('custom-subset', b.markdown);
    expect(b.markdown).not.toMatch(/Training|Heart rate|heart rate|bpm|Strength|Adherence|1-rep/);
    const dailyRows = b.markdown.split('\n').filter((l) => /^\| (Mon 9|Tue 10|Wed 11) Nov/.test(l));
    // Three body rows, three activity and sleep rows, and the one watch-check day.
    expect(dailyRows).toHaveLength(7);
  });

  test('custom 20 days uses medium detail; custom 70 days uses long', () => {
    const medium = brief(syntheticJourney(), 'custom', 'kg', {
      custom: { from: '2026-10-24', to: '2026-11-12' },
    });
    expect(medium.markdown).toContain('— weekly');
    expect(medium.markdown).not.toContain('### Weekly aggregates');
    const long = brief(syntheticJourney(), 'custom', 'kg', {
      custom: { from: '2026-09-03', to: '2026-11-12' },
    });
    expect(long.markdown).toContain('### Weekly aggregates');
    expect(long.markdown).toContain('### Last 14 days');
  });
});

describe('edge cases', () => {
  test('an empty request still returns a title and a single "Choose at least one section." line', () => {
    const request = requestFor('week', { sections: SECTIONS_OFF, starter: 'ignored' });
    const b = buildBriefing(syntheticWeek(), request, { today: SYNTHETIC_TODAY, unit: 'kg' });
    expect(b.markdown).toBe('# Weekly check-in · 6–12 Nov 2026\n\nChoose at least one section.\n');
    expect(sectionsEnabled(request)).toEqual([]);
    expect(sizeLabel(b)).toBe('—');
  });

  test('empty data golden: every enabled section says it has no data and there are no tables', () => {
    const b = brief(emptyData(), 'week');
    expectGolden('empty', b.markdown);
    expect(b.markdown).toContain('- No weigh-ins in this period.');
    expect(b.markdown).toContain('- No workouts logged in this period.');
    expect(b.markdown).toContain('- Steps: no data in this period.');
    expect(b.markdown).toContain('- Sleep: no data in this period.');
    expect(b.markdown).toContain('- Heart rate: no data in this period.');
    expect(b.markdown).not.toContain('|');
    expect(b.markdown).not.toContain('## Detail');
  });

  test('the starter line is omitted when empty and present as a quote when set', () => {
    const empty = brief(syntheticWeek(), 'week', 'kg', { starter: '' });
    expect(empty.markdown).not.toContain('\n> ');
    expect(empty.markdown.split('\n\n')[1]!.startsWith('## Context')).toBe(true);
    const multi = brief(syntheticWeek(), 'week', 'kg', { starter: 'First line\nSecond line' });
    expect(multi.markdown).toContain('> First line\n> Second line\n');
  });

  test('sectionsEnabled for single workout is body and sleep only when toggled', () => {
    expect(sectionsEnabled(requestFor('workout'))).toEqual(['body', 'sleep']);
    expect(
      sectionsEnabled(
        requestFor('workout', { sections: { ...SECTIONS_OFF, sleep: true, heartRate: true } }),
      ),
    ).toEqual(['sleep']);
    expect(sectionsEnabled(requestFor('week'))).toEqual([
      'body',
      'workouts',
      'activity',
      'sleep',
      'heartRate',
    ]);
  });

  test('sizeLabel rounds to 100 and appends " + CSV" only with a CSV', () => {
    const base: Briefing = {
      title: 't',
      markdown: 'x',
      csv: null,
      csvFileName: null,
      characters: 1949,
      lineCount: 1,
    };
    expect(sizeLabel(base)).toBe('About 1,900 characters');
    expect(sizeLabel({ ...base, characters: 1950 })).toBe('About 2,000 characters');
    expect(sizeLabel({ ...base, characters: 12 })).toBe('About 100 characters');
    expect(sizeLabel({ ...base, csv: 'a', csvFileName: 'b.csv' })).toBe(
      'About 1,900 characters + CSV',
    );
  });

  test('the section toggles add and remove only their own text', () => {
    const noBody = brief(syntheticWeek(), 'week', 'kg', {
      sections: { ...SECTIONS_OFF, workouts: true },
    });
    expect(noBody.markdown).not.toContain('Weigh-in');
    expect(noBody.markdown).not.toContain('### Body');
    expect(noBody.markdown).toContain('### Training');
    expect(noBody.markdown).toContain('- Strength:');
  });

  test('a period that includes today but has no activity table still explains the star', () => {
    const b = brief(syntheticWeek(), 'week', 'kg', {
      sections: { ...SECTIONS_OFF, body: true },
    });
    expect(b.markdown).toContain('| Thu 12 Nov* |');
    expect(b.markdown).toContain('* today: the day is not over yet.');
  });
});

test('no goldens contain NaN, undefined, Infinity or [object', () => {
  for (const b of [
    brief(syntheticWeek(), 'week'),
    brief(syntheticWeek(), 'week', 'lb'),
    brief(syntheticWeek(), 'month'),
    brief(syntheticJourney(), 'journey', 'kg', { includeCsv: true }),
    brief(emptyData(), 'week'),
    brief(emptyData(), 'journey'),
    brief(emptyData(), 'month'),
  ]) {
    expect(b.markdown).not.toMatch(BAD_TOKENS);
    expect(b.csv ?? '').not.toMatch(BAD_TOKENS);
  }
});

test('the Markdown has no trailing spaces, no blank-line runs, and ends with exactly one newline', () => {
  for (const b of [
    brief(syntheticWeek(), 'week'),
    brief(syntheticWeek(), 'month'),
    brief(syntheticJourney(), 'journey'),
    brief(emptyData(), 'week'),
  ]) {
    expect(b.markdown.endsWith('\n')).toBe(true);
    expect(b.markdown.endsWith('\n\n')).toBe(false);
    expect(b.markdown).not.toMatch(/[ \t]+\n/);
    expect(b.markdown).not.toContain('\n\n\n');
  }
});

test('privacy: building a briefing writes nothing to the console', () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation(() => undefined),
  );
  brief(syntheticWeek(), 'week');
  brief(syntheticJourney(), 'journey', 'kg', { includeCsv: true });
  for (const spy of spies) {
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  }
});
