import { MAX_PAGES } from './constants';

/** Reads every page of a Health Connect listing, following page tokens in order. */
export async function pageThrough<T>(
  readPage: (pageToken: string | undefined) => Promise<{ records: T[]; pageToken?: string }>,
): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await readPage(pageToken);
    all.push(...result.records);
    if (!result.pageToken) return all;
    pageToken = result.pageToken;
  }
  throw new Error('Health Connect returned too many pages');
}
