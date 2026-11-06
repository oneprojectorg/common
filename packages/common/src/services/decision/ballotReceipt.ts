import {
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * A voter's receipt is the only key to their anonymous ballot: it is returned
 * once, from `submitVote`, and the database keeps only values derived from it.
 *
 * The derivation follows the ElectionGuard pattern of one random ballot nonce
 * from which every other value is drawn through a keyed, domain-separated
 * hash: HKDF-SHA-256 with the receipt as the keying material, the process
 * instance as the salt and a distinct `info` label per use. The lookup hash
 * and the seal key are therefore independent (one cannot be computed from
 * the other), and both are bound to the instance the ballot was cast in.
 *
 * The seal is ElectionGuard's confirmation code reduced to what we need: a
 * MAC over the picks under a key only the receipt holder can derive, so the
 * holder can tell whether the stored picks are still the ones they cast.
 * Anyone who can write the table can change a ballot, but not re-seal it.
 */
const RECEIPT_BYTES = 32;
const KEY_BYTES = 32;
const LOOKUP_INFO = 'op/ballot-receipt/v1/lookup';
const SEAL_INFO = 'op/ballot-receipt/v1/seal';

export interface BallotPick {
  proposalId: string;
  /** 0-based cast order. */
  position: number;
  rank: number | null;
}

export function createBallotReceipt(): string {
  return randomBytes(RECEIPT_BYTES).toString('base64url');
}

/** The value the ballot is stored and found under. Hex. */
export function hashBallotReceipt({
  receipt,
  processInstanceId,
}: {
  receipt: string;
  processInstanceId: string;
}): string {
  return derive({ receipt, processInstanceId, info: LOOKUP_INFO }).toString(
    'hex',
  );
}

/** A MAC over the picks that only the receipt holder can produce. Hex. */
export function sealBallot({
  receipt,
  processInstanceId,
  picks,
}: {
  receipt: string;
  processInstanceId: string;
  picks: BallotPick[];
}): string {
  const key = derive({ receipt, processInstanceId, info: SEAL_INFO });

  return createHmac('sha256', key).update(canonicalPicks(picks)).digest('hex');
}

/** Whether `seal` is the seal of these picks under this receipt. */
export function isBallotSealIntact({
  seal,
  ...ballot
}: {
  receipt: string;
  processInstanceId: string;
  picks: BallotPick[];
  seal: string;
}): boolean {
  const expected = Buffer.from(sealBallot(ballot), 'hex');
  const actual = Buffer.from(seal, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function derive({
  receipt,
  processInstanceId,
  info,
}: {
  receipt: string;
  processInstanceId: string;
  info: string;
}): Buffer {
  // The salt binds every derived value to one instance. Lower-cased so the
  // same uuid, however a caller spelt it, derives the same values.
  return Buffer.from(
    hkdfSync(
      'sha256',
      receipt,
      processInstanceId.toLowerCase(),
      info,
      KEY_BYTES,
    ),
  );
}

/** One byte string per set of picks, whatever order they were read in. */
function canonicalPicks(picks: BallotPick[]): string {
  const ordered = [...picks]
    .sort((a, b) => a.position - b.position)
    .map((pick) => [pick.proposalId.toLowerCase(), pick.position, pick.rank]);

  return JSON.stringify(ordered);
}
