/*
 * A Rust-like match util
 *
 * @example
 * const schema = match(slug, {
 *   'people-powered': () => 'simple',
 *   'cowop': () => {
 *     // Could add complex logic here
 *     console.log('Using cowop schema');
 *     return 'cowop';
 *   },
 *   _: () => 'horizon'
 * });
 *
 * */
export const match = (value: any, cases: Record<string, any>) => {
  for (const [pattern, result] of Object.entries(cases)) {
    if (pattern === '_' || pattern === value) {
      return typeof result === 'function' ? result() : result;
    }
  }

  throw new Error(`No matching case found for value: ${value}`);
};
