import { AsyncLocalStorage } from 'node:async_hooks';

type Sub = Map<string, Promise<unknown>>;
type Store = WeakMap<object, Sub>;

const als = new AsyncLocalStorage<Store>();

export const runWithRequestCache = <T>(fn: () => T): T =>
  als.run(new WeakMap(), fn);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export interface MemoizedFn<TArgs extends unknown[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  invalidate(...args: TArgs): void;
  invalidateAll(): void;
}

export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyFn: (...args: TArgs) => string = (...args) => stableStringify(args),
): MemoizedFn<TArgs, TReturn> {
  const getSub = (): Sub | undefined => {
    const store = als.getStore();
    if (!store) {
      return undefined;
    }
    let sub = store.get(wrapped);
    if (!sub) {
      sub = new Map();
      store.set(wrapped, sub);
    }
    return sub;
  };

  const wrapped = ((...args: TArgs) => {
    const sub = getSub();
    if (!sub) {
      return fn(...args);
    }
    const key = keyFn(...args);
    const hit = sub.get(key);
    if (hit) {
      return hit as Promise<TReturn>;
    }
    const p = fn(...args);
    sub.set(key, p);
    p.catch(() => sub.delete(key));
    return p;
  }) as MemoizedFn<TArgs, TReturn>;

  wrapped.invalidate = (...args: TArgs) => {
    const store = als.getStore();
    const sub = store?.get(wrapped);
    sub?.delete(keyFn(...args));
  };

  wrapped.invalidateAll = () => {
    const store = als.getStore();
    store?.get(wrapped)?.clear();
  };

  return wrapped;
}
