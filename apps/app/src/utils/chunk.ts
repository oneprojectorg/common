/**
 * Splits `items` into consecutive groups of `size`; the last group holds the
 * remainder. Boundaries depend only on position, so appending items leaves
 * every earlier group unchanged.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }

  const groups: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    groups.push(items.slice(start, start + size));
  }

  return groups;
}
