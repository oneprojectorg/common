/**
 * Whether a query is long enough for a search endpoint whose input is
 * `z.string().min(2)`. Zod counts code points, not UTF-16 units, so one emoji
 * is one character here too.
 */
export function isSearchQueryLongEnough(query: string): boolean {
  return Array.from(query).length >= 2;
}
