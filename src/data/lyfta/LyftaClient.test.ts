import { LyftaError, type LyftaErrorKind } from './LyftaError';
import { createLyftaClient, type LyftaClientDeps } from './LyftaClient';

const KEY = 'test-key';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init);
}

function setup(
  responses: (Response | Error)[],
  overrides: Partial<LyftaClientDeps> = {},
  apiKey: string | null = KEY,
) {
  let clock = 0;
  const sleeps: number[] = [];
  const queue = [...responses];
  const fetchFn = jest.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = createLyftaClient({
    fetchFn: fetchFn as unknown as typeof fetch,
    getApiKey: async () => apiKey,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...overrides,
  });
  return { client, fetchFn, sleeps };
}

async function kindOf(
  promise: Promise<unknown>,
): Promise<{ kind: LyftaErrorKind; status?: number }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LyftaError) return { kind: error.kind, status: error.status };
    throw error;
  }
  throw new Error('expected the call to reject');
}

describe('createLyftaClient', () => {
  test('sends the bearer key and query parameters', async () => {
    const { client, fetchFn } = setup([jsonResponse({ workouts: [] })]);

    const result = await client.listWorkouts({
      page: 2,
      limit: 100,
      from: '2026-11-01',
      to: '2026-11-14',
    });

    expect(result).toEqual({ workouts: [] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://my.lyfta.app/api/v1/workouts?page=2&limit=100&from=2026-11-01&to=2026-11-14',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  test('fails as unauthorized without a key and makes no request', async () => {
    const { client, fetchFn } = setup([], {}, null);

    expect((await kindOf(client.getProfile())).kind).toBe('unauthorized');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('maps 401 to unauthorized', async () => {
    const { client } = setup([new Response('no', { status: 401 })]);

    expect(await kindOf(client.getProfile())).toEqual({ kind: 'unauthorized', status: 401 });
  });

  test('maps 500 to server and a thrown fetch to network', async () => {
    const { client } = setup([new Response('boom', { status: 500 }), new TypeError('offline')], {
      minIntervalMs: 0,
    });

    expect(await kindOf(client.getProfile())).toEqual({ kind: 'server', status: 500 });
    expect((await kindOf(client.getProfile())).kind).toBe('network');
  });

  test('maps a non-JSON body to invalid_response', async () => {
    const { client } = setup([new Response('<html>not json</html>', { status: 200 })]);

    expect((await kindOf(client.getProfile())).kind).toBe('invalid_response');
  });

  test('waits for Retry-After on 429 then succeeds', async () => {
    const { client, sleeps } = setup(
      [
        new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } }),
        jsonResponse({ ok: true }),
      ],
      { minIntervalMs: 0 },
    );

    expect(await client.getProfile()).toEqual({ ok: true });
    expect(sleeps).toEqual([5000]);
  });

  test('backs off 2s, 4s, 8s then fails as rate_limited', async () => {
    const { client, fetchFn, sleeps } = setup(
      [429, 429, 429, 429].map((status) => new Response('slow down', { status })),
      { minIntervalMs: 0 },
    );

    expect(await kindOf(client.getProfile())).toEqual({ kind: 'rate_limited', status: 429 });
    expect(sleeps).toEqual([2000, 4000, 8000]);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  test('spaces consecutive requests by minIntervalMs', async () => {
    const { client, sleeps } = setup([jsonResponse({}), jsonResponse({})]);

    await client.getProfile();
    await client.getExerciseProgress();

    expect(sleeps).toEqual([1100]);
  });

  test('never includes the key in error messages', async () => {
    const { client } = setup([new Response(`echo ${KEY}`, { status: 400 })]);

    const error = await client.getProfile().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LyftaError);
    expect((error as LyftaError).kind).toBe('bad_request');
    expect((error as LyftaError).message).not.toContain(KEY);
  });

  test('times out when the body stalls after headers arrive', async () => {
    const fetchFn = jest.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    }));
    const client = createLyftaClient({
      fetchFn: fetchFn as unknown as typeof fetch,
      getApiKey: async () => KEY,
      timeoutMs: 20,
    });

    expect((await kindOf(client.getProfile())).kind).toBe('network');
  });

  test('maps a failing body read to network, not invalid_response', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => {
        throw new TypeError('connection dropped');
      },
    }));
    const client = createLyftaClient({
      fetchFn: fetchFn as unknown as typeof fetch,
      getApiKey: async () => KEY,
    });

    expect((await kindOf(client.getProfile())).kind).toBe('network');
  });
});
