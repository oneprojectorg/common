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

/**
 * The addresses a bulk send should target: rows with a usable email, one entry
 * per inbox. Dedup is case-insensitive (`Ada@` and `ada@` are one inbox); only
 * the key is lowercased, the returned address keeps its casing.
 */
export const selectEmailRecipients = <T extends { email?: string | null }>(
  rows: Array<T>,
): Array<string> => {
  const seen = new Set<string>();
  const recipients: Array<string> = [];

  for (const row of rows.filter(hasEmail)) {
    const key = row.email.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    recipients.push(row.email);
  }

  return recipients;
};
