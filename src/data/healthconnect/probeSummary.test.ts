import { instantTimeOf, summariseBodyRecords, summariseByOrigin } from './probeSummary';

const ORIGIN = 'com.example.scale';

function record(time: string, lastModifiedTime: string, dataOrigin = ORIGIN) {
  return { metadata: { dataOrigin, lastModifiedTime }, time };
}

test('groups count and earliest/latest local day by origin', () => {
  const summary = summariseByOrigin(
    [
      record('2025-03-10T12:00:00Z', '2025-03-10T12:00:00Z'),
      // 03:00Z on 12 March is still 11 March at 23:00 in New York (EDT, UTC-4).
      record('2025-03-12T03:00:00Z', '2025-03-12T03:00:00Z'),
      record('2025-03-09T12:00:00Z', '2025-03-09T12:00:00Z', 'com.other'),
    ],
    instantTimeOf,
  );
  expect(summary).toEqual({
    [ORIGIN]: { count: 2, earliest: '2025-03-10', latest: '2025-03-11' },
    'com.other': { count: 1, earliest: '2025-03-09', latest: '2025-03-09' },
  });
});

test('ignores records with no parseable time and counts none for them', () => {
  const summary = summariseByOrigin(
    [
      { metadata: { dataOrigin: ORIGIN } },
      { metadata: { dataOrigin: ORIGIN }, time: 'not a time' },
      { metadata: { dataOrigin: ORIGIN }, time: '2025-03-10T12:00:00' },
      'garbage',
      record('2025-03-10T12:00:00Z', '2025-03-10T12:00:00Z'),
    ],
    instantTimeOf,
  );
  expect(summary).toEqual({ [ORIGIN]: { count: 1, earliest: '2025-03-10', latest: '2025-03-10' } });
});

test('timeEqLastModified counts records whose time is within 2 s of lastModifiedTime', () => {
  const probe = summariseBodyRecords(
    [
      record('2025-03-10T12:00:00Z', '2025-03-10T12:00:01Z'),
      record('2025-03-11T12:00:00Z', '2025-03-11T12:00:02Z'),
      record('2025-03-12T12:00:00Z', '2025-03-12T12:00:03Z'),
      record('2025-03-13T12:00:00Z', '2025-03-13T18:00:00Z'),
    ],
    ORIGIN,
  );
  expect(probe.count).toBe(4);
  expect(probe.timeEqLastModified).toBe(2);
});

test('batchedWrites counts records sharing a lastModified second with a record whose time differs by over 2 minutes', () => {
  const probe = summariseBodyRecords(
    [
      // Two weigh-ins synced in one batch at 20:00:00.
      record('2025-03-10T08:00:00Z', '2025-03-10T20:00:00.100Z'),
      record('2025-03-10T09:00:00Z', '2025-03-10T20:00:00.900Z'),
      // Two records one minute apart sharing a second are not a batch.
      record('2025-03-11T08:00:00Z', '2025-03-11T08:00:05Z'),
      record('2025-03-11T08:01:00Z', '2025-03-11T08:00:05Z'),
      // A lone record.
      record('2025-03-12T08:00:00Z', '2025-03-12T08:00:00Z'),
    ],
    ORIGIN,
  );
  expect(probe.batchedWrites).toBe(2);
});

test('days-per-count histogram, adjacent-pair counts under both rules, and the 24-bucket local hour histogram', () => {
  const probe = summariseBodyRecords(
    [
      // 10 March: one record at 08:00 EDT.
      record('2025-03-10T12:00:00Z', '2025-03-10T12:00:00Z'),
      // 11 March: two records 60 s apart at 07:00 EDT.
      record('2025-03-11T11:00:00Z', '2025-03-11T11:00:00Z'),
      record('2025-03-11T11:01:00Z', '2025-03-11T11:01:00Z'),
      // 12 March: three records hours apart (07:00, 09:00, 21:00 EDT).
      record('2025-03-12T11:00:00Z', '2025-03-12T11:00:00Z'),
      record('2025-03-12T13:00:00Z', '2025-03-12T13:00:00Z'),
      record('2025-03-13T01:00:00Z', '2025-03-13T01:00:00Z'),
      // Another origin is ignored.
      record('2025-03-12T14:00:00Z', '2025-03-12T14:00:00Z', 'com.other'),
    ],
    ORIGIN,
  );
  expect(probe.origin).toBe(ORIGIN);
  expect(probe.count).toBe(6);
  expect(probe.daysWithOne).toBe(1);
  expect(probe.daysWithTwo).toBe(1);
  expect(probe.daysWithThreePlus).toBe(1);
  expect(probe.pairsTimeWindow).toBe(1);
  // Adjacent same-day pairs: 11 March (1) and 12 March (2).
  expect(probe.pairsSameDay).toBe(3);
  expect(probe.hourHistogram).toHaveLength(24);
  expect(probe.hourHistogram[7]).toBe(3);
  expect(probe.hourHistogram[8]).toBe(1);
  expect(probe.hourHistogram[9]).toBe(1);
  expect(probe.hourHistogram[21]).toBe(1);
});
