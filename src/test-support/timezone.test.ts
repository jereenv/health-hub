test('tests run in America/New_York', () => {
  expect(new Date('2026-11-12T12:00:00Z').getTimezoneOffset()).toBe(300);
  expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(240);
});
