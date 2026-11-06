import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison for signature/secret checks, so the
 *  comparison can't be used as a timing oracle. Leaks only the length. */
export const timingSafeStringEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};
