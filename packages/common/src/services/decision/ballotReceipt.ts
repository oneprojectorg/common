import { createHash, randomBytes } from 'node:crypto';

/**
 * A voter's receipt is the only key to their anonymous ballot: it is returned
 * once, from `submitVote`, and the database keeps only its hash.
 */
export function createBallotReceipt(): {
  receipt: string;
  receiptHash: string;
} {
  const receipt = randomBytes(32).toString('base64url');

  return { receipt, receiptHash: hashBallotReceipt(receipt) };
}

export function hashBallotReceipt(receipt: string): string {
  return createHash('sha256').update(receipt).digest('hex');
}
