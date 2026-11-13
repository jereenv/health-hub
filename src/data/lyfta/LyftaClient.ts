import { LyftaError } from './LyftaError';

export const LYFTA_BASE_URL = 'https://my.lyfta.app';

export interface LyftaClientDeps {
  fetchFn: typeof fetch;
  getApiKey: () => Promise<string | null>;
  baseUrl?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Minimum gap between request starts. 1100 ms keeps us under Lyfta's 60 requests/minute. */
  minIntervalMs?: number;
  /** Retries after a 429 response (other failures are not retried). */
  maxRetries?: number;
  timeoutMs?: number;
}

export interface LyftaClient {
  listWorkouts(p: { page: number; limit: number; from?: string; to?: string }): Promise<unknown>;
  listSchedule(p: { from?: string; to?: string; includeCompleted?: boolean }): Promise<unknown>;
  getProfile(): Promise<unknown>;
  getExerciseProgress(): Promise<unknown>;
}

const DEFAULT_MIN_INTERVAL_MS = 1100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const INITIAL_BACKOFF_MS = 2000;

type QueryValue = string | number | boolean | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

/** Seconds from a Retry-After header, or null when absent or not a plain number. */
function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/**
 * Creates a Lyfta REST client. Runs on both React Native (Hermes) and Node, so it only relies on
 * `fetch`, `AbortController` and timers. Error messages never include the API key or response
 * bodies, since a server could echo the key back.
 */
export function createLyftaClient(deps: LyftaClientDeps): LyftaClient {
  const baseUrl = deps.baseUrl ?? LYFTA_BASE_URL;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const minIntervalMs = deps.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastStart: number | null = null;

  /** Waits until minIntervalMs has passed since the previous request started. */
  async function waitForSlot(): Promise<void> {
    const current = now();
    const wait = lastStart === null ? 0 : Math.max(0, minIntervalMs - (current - lastStart));
    // Reserve the slot before sleeping so concurrent callers queue behind each other.
    lastStart = current + wait;
    if (wait > 0) await sleep(wait);
  }

  /**
   * Performs one request and reads the whole body before the timeout is cleared, so the timeout
   * also covers a server that sends headers and then stalls. Any failure here is a network error.
   */
  async function fetchOnce(url: string, apiKey: string): Promise<{ response: Response; body: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await deps.fetchFn(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      const body = await response.text();
      return { response, body };
    } catch {
      throw new LyftaError('network', 'Could not reach Lyfta (network error or timeout)');
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(path: string, query: Record<string, QueryValue> = {}): Promise<unknown> {
    const apiKey = await deps.getApiKey();
    if (apiKey === null) {
      throw new LyftaError('unauthorized', 'No Lyfta API key is configured');
    }
    const url = `${baseUrl}${path}${buildQuery(query)}`;

    for (let attempt = 0; ; attempt++) {
      await waitForSlot();
      const { response, body } = await fetchOnce(url, apiKey);

      if (response.status === 429) {
        if (attempt >= maxRetries) {
          throw new LyftaError('rate_limited', 'Lyfta rate limit still exceeded after retries', 429);
        }
        await sleep(retryAfterMs(response) ?? INITIAL_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      if (response.status === 401) {
        throw new LyftaError('unauthorized', 'Lyfta rejected the API key', 401);
      }
      if (response.status === 400) {
        throw new LyftaError('bad_request', 'Lyfta rejected the request as invalid', 400);
      }
      if (!response.ok) {
        throw new LyftaError('server', `Lyfta responded with status ${response.status}`, response.status);
      }

      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new LyftaError('invalid_response', 'Lyfta returned a body that is not valid JSON', response.status);
      }
    }
  }

  return {
    listWorkouts: ({ page, limit, from, to }) => request('/api/v1/workouts', { page, limit, from, to }),
    listSchedule: ({ from, to, includeCompleted }) =>
      request('/api/v1/schedule', { from, to, include_completed: includeCompleted }),
    getProfile: () => request('/api/v1/profile'),
    getExerciseProgress: () => request('/api/v1/exercises/progress'),
  };
}
