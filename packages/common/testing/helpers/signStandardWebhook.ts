import { createHmac } from 'node:crypto';

/**
 * Builds a Standard Webhooks `webhook-signature` value the way GoTrue does:
 * `v1,` + base64 HMAC-SHA256 over `<id>.<timestamp>.<body>` with the decoded
 * `v1,whsec_<base64>` secret. Independent of the verifier so the tests check
 * it against a second implementation.
 */
export const signStandardWebhook = ({
  id,
  timestamp,
  rawBody,
  secret,
}: {
  id: string;
  /** Unix seconds. */
  timestamp: number;
  rawBody: string;
  secret: string;
}): string => {
  const encoded = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = Buffer.from(encoded, 'base64');
  if (key.length === 0) {
    throw new Error('signStandardWebhook: the secret decodes to nothing');
  }
  const digest = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');
  return `v1,${digest}`;
};
