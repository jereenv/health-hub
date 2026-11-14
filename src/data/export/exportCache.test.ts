import { EXPORT_CACHE_DIR, safeExportFileName } from './exportCache';

test('safeExportFileName keeps letters, digits, dot, dash and underscore and replaces everything else with -', () => {
  expect(safeExportFileName('health-hub_journey.v2.csv')).toBe('health-hub_journey.v2.csv');
  expect(safeExportFileName('my file (1)?.csv')).toBe('my-file--1--.csv');
  expect(safeExportFileName('journey ñ.csv')).toBe('journey--.csv');
});

test('safeExportFileName never returns an empty string or a leading dot, and never contains a slash', () => {
  expect(safeExportFileName('')).toBe('export');
  expect(safeExportFileName('...')).toBe('export');
  expect(safeExportFileName('.hidden')).toBe('hidden');
  expect(safeExportFileName('../../etc/passwd')).toBe('-..-etc-passwd');
  for (const name of ['a/b', 'a\\b', '/', '..', '/..']) {
    const safe = safeExportFileName(name);
    expect(safe).not.toMatch(/[/\\]/);
    expect(safe.length).toBeGreaterThan(0);
    expect(safe.startsWith('.')).toBe(false);
  }
});

test('EXPORT_CACHE_DIR is a plain folder name', () => {
  expect(EXPORT_CACHE_DIR).toMatch(/^[A-Za-z0-9_-]+$/);
});
