import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison for signature/secret checks, so the
 *  comparison can't be used as a timing oracle. Leaks only the length. */
export const timingSafeStringEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

/** Case-insensitive header lookup: the webhook route lowercases incoming
 *  header names, but vendors document them in mixed case. */
export const headerValue = (
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
