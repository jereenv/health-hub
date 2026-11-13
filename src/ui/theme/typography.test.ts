import { TYPE } from './typography';

test('display is 34/40 bold with -0.02em tracking', () =>
  expect(TYPE.display).toMatchObject({
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.68,
  }));

test('hero and stat use tabular figures', () => {
  expect(TYPE.hero.fontVariant).toContain('tabular-nums');
  expect(TYPE.stat.fontVariant).toContain('tabular-nums');
});

test('every variant uses Geist or Geist Mono', () =>
  Object.values(TYPE).forEach((style) =>
    expect(['Geist', 'GeistMono']).toContain(style.fontFamily),
  ));
