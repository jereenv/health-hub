import { LyftaError } from './LyftaError';
import { parseSchedulePage } from './parseSchedule';

const fixture = require('@/data/lyfta/__fixtures__/schedule-page.json');

function page(workouts: unknown[], extra: Record<string, unknown> = {}) {
  return { workouts, ...extra };
}

test('parses items into calendar dates and keeps raw JSON', () => {
  const parsed = parseSchedulePage(fixture);

  expect(parsed.items[0].item).toEqual({
    lyftaId: 'sched-1001',
    date: '2026-01-20',
    title: 'Lower Strength B',
    templateId: 'tmpl-2001',
    source: 'program',
    status: 'scheduled',
    completed: false,
  });
  expect(parsed.items[1].item.completed).toBe(true);
  expect(JSON.parse(parsed.items[0].rawJson)).toEqual(fixture.workouts[0]);
  expect(parsed).toMatchObject({ currentPage: 1, totalPages: 1, totalRecords: 3 });
});

test('skips items without an id or a valid date and counts them', () => {
  const parsed = parseSchedulePage(fixture);
  expect(parsed.items).toHaveLength(2);
  expect(parsed.skipped).toBe(1);

  const noId = parseSchedulePage(page([{ title: 'x', scheduled_date: '2026-01-20' }]));
  expect(noId).toMatchObject({ items: [], skipped: 1 });
});

test('accepts numeric ids and string pagination', () => {
  const parsed = parseSchedulePage(
    page([{ id: 7, scheduled_date: '2026-01-20', template_id: 9 }], {
      current_page: '1',
      total_pages: '2',
      total_records: '150',
    }),
  );
  expect(parsed.items[0].item).toMatchObject({ lyftaId: '7', templateId: '9' });
  expect(parsed).toMatchObject({ currentPage: 1, totalPages: 2, totalRecords: 150 });
});

test('keeps the calendar day of a date-only value and of an ISO date-time as written', () => {
  const parsed = parseSchedulePage(
    page([
      { id: 'a', scheduled_date: '2026-01-20' },
      { id: 'b', scheduled_date: '2026-01-21T23:30:00Z' },
    ]),
  );
  expect(parsed.items.map((i) => i.item.date)).toEqual(['2026-01-20', '2026-01-21']);
});

test('a missing title falls back to Workout and a missing flag to not completed', () => {
  const parsed = parseSchedulePage(
    page([
      { id: 'a', scheduled_date: '2026-01-20' },
      { id: 'b', scheduled_date: '2026-01-20', title: '   ' },
    ]),
  );
  expect(parsed.items.map((i) => i.item.title)).toEqual(['Workout', 'Workout']);
  expect(parsed.items[0].item).toMatchObject({
    templateId: null,
    source: null,
    status: null,
    completed: false,
  });
});

test('defaults pagination to one page and an unknown total', () => {
  expect(parseSchedulePage(page([]))).toMatchObject({
    currentPage: 1,
    totalPages: 1,
    totalRecords: null,
  });
  expect(parseSchedulePage(page([], { total_records: 'many' })).totalRecords).toBeNull();
});

test('rejects a response without a workouts array', () => {
  expect(() => parseSchedulePage({ status: true })).toThrow(LyftaError);
  expect(() => parseSchedulePage(null)).toThrow(LyftaError);
});
