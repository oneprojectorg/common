import { createHmac, timingSafeEqual } from 'node:crypto';

/** How far a `webhook-timestamp` may sit from now before a replayed request is refused. */
const TOLERANCE_SECONDS = 5 * 60;

const SECRET_PREFIX = 'whsec_';

/**
 * Decodes Supabase hook secrets: `v1,whsec_<base64>`, several joined by `|`
 * during a rotation. The `v1,` and `whsec_` prefixes are optional.
 */
const parseSecrets = (secrets: string): Buffer[] =>
  secrets
    .split(/[|\s]+/)
    .filter(Boolean)
    .map((entry) => {
      const unversioned = entry.startsWith('v1,') ? entry.slice(3) : entry;
      const encoded = unversioned.startsWith(SECRET_PREFIX)
        ? unversioned.slice(SECRET_PREFIX.length)
        : unversioned;
      return Buffer.from(encoded, 'base64');
    })
    .filter((key) => key.length > 0);

const headerValue = (
  headers: Record<string, string>,
  name: string,
): string | undefined => {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
};

const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

const sign = (key: Buffer, content: string): string =>
  createHmac('sha256', key).update(content).digest('base64');

/**
 * Checks a Standard Webhooks signature (https://www.standardwebhooks.com):
 * HMAC-SHA256 over `<webhook-id>.<webhook-timestamp>.<body>` with the decoded
 * secret, offered as `v1,<base64>` entries separated by spaces (or GoTrue's
 * ", "). Any secret matching any entry passes, so a rotation keeps the old
 * secret valid.
 */
export const verifyStandardWebhookSignature = ({
  rawBody,
  headers,
  secrets,
  now,
}: {
  rawBody: string;
  headers: Record<string, string>;
  secrets: string;
  /** Milliseconds since the epoch. */
  now: number;
}): boolean => {
  const id = headerValue(headers, 'webhook-id');
  const timestamp = headerValue(headers, 'webhook-timestamp');
  const signature = headerValue(headers, 'webhook-signature');
  if (!id || !timestamp || !signature) {
    return false;
  }

  const sentAt = Number(timestamp);
  if (
    !Number.isInteger(sentAt) ||
    Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS
  ) {
    return false;
  }

  // GoTrue joins several signatures with ", " rather than the spec's space, so
  // an entry may carry a trailing comma; split on the comma instead of slicing.
  const offered = signature
    .split(/\s+/)
    .map((entry) => entry.split(','))
    .filter((parts) => parts[0] === 'v1' && parts[1])
    .map((parts) => parts[1] ?? '');
  if (offered.length === 0) {
    return false;
  }

  const content = `${id}.${timestamp}.${rawBody}`;
  return parseSecrets(secrets).some((key) => {
    const expected = sign(key, content);
    return offered.some((entry) => safeEqual(entry, expected));
  });
};
