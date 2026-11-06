import { z } from 'zod';

/** A ballot receipt: 32 random bytes in base64url. */
export const ballotReceiptSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
