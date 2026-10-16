import { describe, expect, it, vi } from 'vitest';

import { createSaveQueue } from './saveQueue';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createSaveQueue', () => {
  it('given two saves in a row, when the first is slow, then the second starts only after the first finishes and idle fires once at the end', async () => {
    const first = deferred();
    const started: string[] = [];
    const onIdle = vi.fn();
    const save = createSaveQueue<string>({
      run: (item) => {
        started.push(item);
        return item === 'off' ? first.promise : Promise.resolve();
      },
      onIdle,
    });

    void save('off');
    const second = save('on');
    await Promise.resolve();

    expect(started).toEqual(['off']);
    expect(onIdle).not.toHaveBeenCalled();

    first.resolve();
    await second;

    expect(started).toEqual(['off', 'on']);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('given a save that fails, when another is queued behind it, then the later save still runs and idle fires', async () => {
    const onIdle = vi.fn();
    const ran: string[] = [];
    const save = createSaveQueue<string>({
      run: (item) => {
        ran.push(item);
        return item === 'bad'
          ? Promise.reject(new Error('nope'))
          : Promise.resolve();
      },
      onIdle,
    });

    void save('bad');
    await save('good');

    expect(ran).toEqual(['bad', 'good']);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
