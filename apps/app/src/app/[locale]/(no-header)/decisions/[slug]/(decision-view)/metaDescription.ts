/**
 * Collapse whitespace and clamp to a meta-description-friendly length.
 * Code-point aware (iterates with the spread operator) so a multi-byte
 * character straddling the limit isn't cut mid-surrogate.
 */
export function truncateDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = [...clean];
  if (chars.length <= max) {
    return clean;
  }
  // -1 leaves room for the ellipsis so the result stays within `max`.
  return `${chars
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`;
}
