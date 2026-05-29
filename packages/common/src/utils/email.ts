/**
 * Email-related helpers. Kept pure (no imports) so they stay safe to re-export
 * from the client surface (see client.ts).
 */

/**
 * Type guard for rows with a usable email. Treats null, undefined, and '' all
 * as absent (no format validation), so anonymous users are filtered out rather
 * than collapsed into an empty entry. Narrows `email` to a non-empty string so
 * callers can use it directly without coalescing or asserting.
 */
export const hasEmail = <T extends { email?: string | null }>(
  row: T,
): row is T & { email: string } => Boolean(row.email);
