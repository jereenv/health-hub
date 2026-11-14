import { matchesScale } from './discovery';

test.each([
  ['the scale name with nothing remembered', { id: 'a', name: 'IF_B2A' }, null, true],
  ['another name with nothing remembered', { id: 'a', name: 'Other' }, null, false],
  ['no name with nothing remembered', { id: 'a', name: null }, null, false],
  ['the remembered id with a different name', { id: 'a', name: 'Other' }, 'a', true],
  ['the scale name but another remembered id', { id: 'b', name: 'IF_B2A' }, 'a', false],
])('%s', (_name, peripheral, remembered, expected) => {
  expect(matchesScale(peripheral, remembered)).toBe(expected);
});
