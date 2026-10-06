import { getRequest } from '@tanstack/react-start/server';

/**
 * Memoizes `fn` for the lifetime of the current request, so the loaders of one
 * page render share a result instead of each re-querying. Arguments are keyed
 * by value, so call it with serializable arguments only.
 */
export const cachePerRequest = <TArgs extends Array<unknown>, TResult>(
  fn: (...args: TArgs) => TResult,
) => {
  const resultsByRequest = new WeakMap<Request, Map<string, TResult>>();

  return (...args: TArgs): TResult => {
    const request = getRequest();
    let results = resultsByRequest.get(request);

    if (!results) {
      results = new Map();
      resultsByRequest.set(request, results);
    }

    const key = JSON.stringify(args);

    const cached = results.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    results.set(key, result);

    return result;
  };
};
