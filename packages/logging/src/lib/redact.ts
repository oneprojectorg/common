import { z } from 'zod';

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
 * Detection splits the string into candidates and asks zod whether each one is
 * an address, rather than scanning for a pattern. A scanning regex has to leave
 * its start position free, and the local part and the `%40` separator share the
 * `%` character, so the two competed and the match backtracked — CodeQL flagged
 * it as polynomial on strings with many `%` (code-scanning/39). Splitting on a
 * plain character class is linear, and zod's own pattern is anchored and reads a
 * candidate no longer than an address can be.
 */
const emailSchema = z.email();

/** RFC 5321 caps an address at 254 characters. */
const MAX_EMAIL_LENGTH = 254;

/**
 * Characters that cannot appear in an address zod accepts, so they end a
 * candidate. `%` is kept inside a candidate for the percent-encoded separator.
 */
const CANDIDATE_BOUNDARY = /([^A-Za-z0-9_'+\-.@%]+)/;

/**
 * Legal inside an address but usually sentence punctuation when it trails one,
 * as in "Invited person@example.com."
 */
const TRAILING_PUNCTUATION = new Set(['.', "'", '+', '_', '-']);

const REDACTED_LOCAL_PART = '[redacted]';
const ENCODED_SEPARATOR = '%40';

/**
 * Replace every email address in `value` with `[redacted]@<domain>`, keeping the
 * separator as written so a percent-encoded address still reads as a URL. Leaves
 * a string with no address untouched.
 */
export function redactEmails(value: string): string {
  // Every log attribute passes through here, so skip the work on the strings
  // that cannot contain an address.
  if (!value.includes('@') && !value.includes(ENCODED_SEPARATOR)) {
    return value;
  }

  // The capturing group keeps the boundaries in the result, so joining the
  // parts back together reproduces the original string.
  return value.split(CANDIDATE_BOUNDARY).map(redactCandidate).join('');
}

function redactCandidate(candidate: string): string {
  let end = candidate.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(candidate.charAt(end - 1))) {
    end--;
  }

  const core = candidate.slice(0, end);
  if (core.length > MAX_EMAIL_LENGTH) {
    return candidate;
  }

  // `encodeURIComponent` writes `@` as `%40`, so a URL carries the address in
  // that spelling. Normalise it for the check and keep the original for output.
  const separatorIndex = core.includes('@')
    ? core.indexOf('@')
    : core.indexOf(ENCODED_SEPARATOR);
  if (separatorIndex === -1) {
    return candidate;
  }

  const separatorLength =
    core.charAt(separatorIndex) === '@' ? 1 : ENCODED_SEPARATOR.length;
  const localPart = core.slice(0, separatorIndex);
  const domain = core.slice(separatorIndex + separatorLength);

  if (!emailSchema.safeParse(`${localPart}@${domain}`).success) {
    return candidate;
  }

  return `${REDACTED_LOCAL_PART}${candidate.slice(separatorIndex)}`;
}
