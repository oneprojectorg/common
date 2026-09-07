/**
 * Email addresses are personal data, and a log record shipped to PostHog has no
 * retention limit, so an address written to one outlives every purpose it was
 * collected for (GDPR Art. 5(1)(c)). The domain is what the logs are actually
 * read for — it drives the allow-list decision on the login path — so keep it
 * and drop the local part.
 *
 * The local part is dropped rather than hashed: an unsalted hash of an email is
 * reversible from a dictionary of addresses, so it would carry the personal data
 * forward under a different spelling.
 *
 * The TLD must be alphabetic and at least two characters so a version spec
 * (`@op/logging@0.1.0`) is not mistaken for an address. The domain segments and
 * the separator use disjoint character classes, which keeps the match linear.
 */
const EMAIL_PATTERN =
  /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

const REDACTED_LOCAL_PART = '[redacted]';

/**
 * Replace every email address in `value` with `[redacted]@<domain>`. Leaves a
 * string with no address untouched.
 */
export function redactEmails(value: string): string {
  // Every log attribute passes through here, so skip the regex on the strings
  // that cannot contain an address.
  if (!value.includes('@')) {
    return value;
  }

  return value.replace(
    EMAIL_PATTERN,
    (_match, domain: string) => `${REDACTED_LOCAL_PART}@${domain}`,
  );
}
