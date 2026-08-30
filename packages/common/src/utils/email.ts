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
 * The addresses a bulk send should actually target: rows with a usable email,
 * collapsed to one entry per address. Dedup is case-insensitive because SMTP
 * treats the domain — and in practice the whole address — case-insensitively,
 * so `Ada@example.com` and `ada@example.com` are one inbox and must not both
 * be mailed. The original casing is preserved in the returned address; only
 * the dedup key is lowercased.
 *
 * Pure and shared so a sender's audience filter is testable on its own, rather
 * than re-derived at each call site.
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
