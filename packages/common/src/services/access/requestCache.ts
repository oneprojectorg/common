import { AsyncLocalStorage } from 'node:async_hooks';

type Cache = Map<string, Promise<unknown>>;
const als = new AsyncLocalStorage<Map<symbol, Cache>>();

export const runWithRequestCache = <T>(fn: () => T): T =>
  als.run(new Map(), fn);

export interface MemoizedFn<TArgs extends unknown[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  invalidate(...args: TArgs): void;
  invalidateAll(): void;
}

export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyFn: (...args: TArgs) => string,
): MemoizedFn<TArgs, TReturn> {
  const id = Symbol();

  const call = (...args: TArgs): Promise<TReturn> => {
    const store = als.getStore();
    if (!store) {
      return fn(...args);
    }

    let cache = store.get(id);
    if (!cache) {
      cache = new Map();
      store.set(id, cache);
    }

    const key = keyFn(...args);
    const hit = cache.get(key) as Promise<TReturn> | undefined;
    if (hit) {
      return hit;
    }

    const promise = fn(...args);
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  };

  return Object.assign(call, {
    invalidate: (...args: TArgs) =>
      als
        .getStore()
        ?.get(id)
        ?.delete(keyFn(...args)),
    invalidateAll: () => als.getStore()?.get(id)?.clear(),
  });
}
