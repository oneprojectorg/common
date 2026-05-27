import { AsyncLocalStorage } from 'node:async_hooks';

type Store = Map<string, Promise<unknown>>;

const als = new AsyncLocalStorage<Store>();

export const runWithRequestCache = <T>(fn: () => T): T =>
  als.run(new Map(), fn);

const getStore = (): Store | undefined => als.getStore();

export async function memoRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const store = getStore();
  if (!store) {
    return fetcher();
  }
  const hit = store.get(key);
  if (hit) {
    return hit as Promise<T>;
  }
  const p = fetcher();
  store.set(key, p);
  p.catch(() => store.delete(key));
  return p as Promise<T>;
}

export function invalidateRequest(prefix: string) {
  const store = getStore();
  if (!store) {
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) {
      store.delete(k);
    }
  }
}
