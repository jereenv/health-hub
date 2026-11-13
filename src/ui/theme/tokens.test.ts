import { contrastRatio } from './contrast';
import { COLORS } from './tokens';

test('approved tokens are exact', () => {
  expect(COLORS.dark).toMatchObject({
    bg: '#0A0A0B',
    card: '#141416',
    raised: '#1E1E22',
    ink: '#F5F5F7',
    muted: '#9A9AA2',
    accent: '#D2FF52',
    onAccent: '#0A0A0B',
    accentInk: '#D2FF52',
    statusLow: '#5A82E6',
    statusOk: '#14A086',
    statusHigh: '#BF8228',
    line: 'rgba(255,255,255,0.08)',
  });
  expect(COLORS.light).toMatchObject({
    bg: '#FFFFFF',
    card: '#F6F6F8',
    raised: '#FFFFFF',
    ink: '#111111',
    muted: '#6B6B73',
    accent: '#D2FF52',
    onAccent: '#111111',
    accentInk: '#4D6B00',
    statusLow: '#3A63D8',
    statusOk: '#0F8A73',
    statusHigh: '#B8741A',
    line: 'rgba(0,0,0,0.07)',
  });
});

test('mockup-derived tokens are exact', () => {
  expect(COLORS.dark).toMatchObject({
    track: 'rgba(255,255,255,0.10)',
    grid: 'rgba(255,255,255,0.06)',
    bar: 'rgba(255,255,255,0.22)',
    nav: 'rgba(16,16,18,0.84)',
    scrim: 'rgba(0,0,0,0.5)',
  });
  expect(COLORS.light).toMatchObject({
    track: 'rgba(0,0,0,0.08)',
    grid: 'rgba(0,0,0,0.06)',
    bar: 'rgba(0,0,0,0.18)',
    nav: 'rgba(255,255,255,0.88)',
    scrim: 'rgba(0,0,0,0.3)',
  });
});

test.each(['dark', 'light'] as const)('%s text tokens reach 4.5:1', (s) => {
  const c = COLORS[s];
  for (const fg of [c.ink, c.muted, c.accentInk]) {
    expect(contrastRatio(fg, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fg, c.bg)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
});

test.each(['dark', 'light'] as const)('%s status colours reach 3:1 on card', (s) => {
  const c = COLORS[s];
  for (const fg of [c.statusLow, c.statusOk, c.statusHigh]) {
    expect(contrastRatio(fg, c.card)).toBeGreaterThanOrEqual(3);
  }
});

test('contrastRatio matches the WCAG reference values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
});

test('contrastRatio rejects non #RRGGBB colours', () => {
  expect(() => contrastRatio('rgba(0,0,0,0.5)', '#FFFFFF')).toThrow();
});
