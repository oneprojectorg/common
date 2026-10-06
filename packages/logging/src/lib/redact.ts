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

/**
 * A phone number as a person types it or as E.164 writes it: seven to fifteen
 * digits in one run, or a North American number split by spaces, dots, or
 * dashes. The lookarounds keep a longer digit run — a database id, a Snowflake
 * id — in one piece rather than redacting its tail, and the digit minimum
 * leaves a five-digit vendor error code and a four-digit year alone.
 */
const PHONE_NUMBER =
  /(?<!\d)\+?\d{7,15}(?!\d)|(?<!\d)\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g;

const REDACTED_PHONE = '[phone]';

/**
 * Replace every phone number in `value` with `[phone]`. A number is personal
 * data for the same reason an address is, and a vendor's error message echoes
 * the number it refused, so the message cannot be logged as it arrives.
 */
export function redactPhoneNumbers(value: string): string {
  return value.replace(PHONE_NUMBER, REDACTED_PHONE);
}

/**
 * A Twilio resource SID: a two-letter type prefix and 32 hex characters.
 * `AC` is the account, `VA` a Verify service, `MG` a Messaging Service, `SK`
 * an API key, `SM`/`MM` a message, `VE` a verification. Twilio's error text
 * names the account and the service it could not find, and the account SID
 * is half of a credential pair, so none of them belong in a log.
 */
const TWILIO_SID = /\b(?:AC|VA|MG|SK|SM|MM|VE|IS)[0-9a-f]{32}\b/g;

const REDACTED_TWILIO_SID = '[twilio-sid]';

/** Replace every Twilio SID in `value` with `[twilio-sid]`. */
export function redactTwilioSids(value: string): string {
  return value.replace(TWILIO_SID, REDACTED_TWILIO_SID);
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
