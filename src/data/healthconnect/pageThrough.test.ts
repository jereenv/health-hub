import { MAX_PAGES } from './constants';
import { pageThrough } from './pageThrough';

test('follows page tokens until none is returned and concatenates in order', async () => {
  const pages: Record<string, { records: number[]; pageToken?: string }> = {
    first: { records: [1, 2], pageToken: 'second' },
    second: { records: [3], pageToken: 'third' },
    third: { records: [4, 5] },
  };
  const readPage = jest.fn(async (token: string | undefined) => pages[token ?? 'first']!);
  await expect(pageThrough(readPage)).resolves.toEqual([1, 2, 3, 4, 5]);
  expect(readPage.mock.calls.map(([token]) => token)).toEqual([undefined, 'second', 'third']);
});

test('stops with an error after MAX_PAGES pages', async () => {
  const readPage = jest.fn(async () => ({ records: [1], pageToken: 'more' }));
  await expect(pageThrough(readPage)).rejects.toThrow('Health Connect returned too many pages');
  expect(readPage).toHaveBeenCalledTimes(MAX_PAGES);
});
