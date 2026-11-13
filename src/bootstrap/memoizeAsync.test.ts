import { memoizeAsync } from './memoizeAsync';

test('memoizeAsync shares one result and retries after a failure', async () => {
  let calls = 0;
  let fail = true;
  const memo = memoizeAsync(async () => {
    calls += 1;
    if (fail) throw new Error('boom');
    return { calls };
  });

  const first = memo.get();
  expect(memo.get()).toBe(first);
  await expect(first).rejects.toThrow('boom');
  expect(calls).toBe(1);

  fail = false;
  const second = await memo.get();
  expect(second).toEqual({ calls: 2 });
  expect(await memo.get()).toBe(second);
  expect(calls).toBe(2);

  memo.reset();
  expect(await memo.get()).toEqual({ calls: 3 });
});

test('memoizeAsync turns a synchronous throw into a rejection that is not kept', async () => {
  let calls = 0;
  const memo = memoizeAsync<number>(() => {
    calls += 1;
    if (calls === 1) throw new Error('sync boom');
    return Promise.resolve(calls);
  });
  await expect(memo.get()).rejects.toThrow('sync boom');
  expect(await memo.get()).toBe(2);
});
