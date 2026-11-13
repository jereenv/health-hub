import { LyftaError } from './LyftaError';

/** Hard ceiling on pages fetched in one listing, whatever the server claims. */
export const LYFTA_MAX_PAGES = 200;
/** Pages beyond the record count's own, tolerating records added while paging. */
const PAGE_CAP_SLACK = 2;

/**
 * The most pages a listing may legitimately take given the server's `total_records`; a server that
 * pages beyond this is misbehaving. Unknown totals fall back to the hard ceiling.
 */
export function pageCapFor(totalRecords: number | null, pageSize: number): number {
  if (totalRecords === null) return LYFTA_MAX_PAGES;
  return Math.min(
    LYFTA_MAX_PAGES,
    Math.ceil(Math.max(0, totalRecords) / pageSize) + PAGE_CAP_SLACK,
  );
}

/** The error a paging loop throws before fetching a page beyond its cap. */
export function tooManyPagesError(): LyftaError {
  return new LyftaError('invalid_response', 'Lyfta returned more pages than expected');
}
