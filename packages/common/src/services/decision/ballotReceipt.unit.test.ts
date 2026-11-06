import { describe, expect, it } from 'vitest';

import {
  type BallotPick,
  createBallotReceipt,
  hashBallotReceipt,
  isBallotSealIntact,
  sealBallot,
} from './ballotReceipt';

const instanceA = '0b1b3a3e-4d7a-4f3c-9d0f-0a2b7c6e5d4f';
const instanceB = '9f8e7d6c-5b4a-4321-8765-4321fedcba98';

const picks: BallotPick[] = [
  { proposalId: '11111111-1111-4111-8111-111111111111', position: 0, rank: 1 },
  { proposalId: '22222222-2222-4222-8222-222222222222', position: 1, rank: 2 },
];

describe('createBallotReceipt', () => {
  it('issues a distinct 256-bit receipt each time', () => {
    const receipts = new Set(
      Array.from({ length: 100 }, () => createBallotReceipt()),
    );

    expect(receipts.size).toBe(100);
    for (const receipt of receipts) {
      expect(Buffer.from(receipt, 'base64url')).toHaveLength(32);
    }
  });
});

describe('hashBallotReceipt', () => {
  it('is deterministic for one receipt on one instance', () => {
    const receipt = createBallotReceipt();

    expect(hashBallotReceipt({ receipt, processInstanceId: instanceA })).toBe(
      hashBallotReceipt({ receipt, processInstanceId: instanceA }),
    );
  });

  it('binds the hash to the instance', () => {
    const receipt = createBallotReceipt();

    expect(
      hashBallotReceipt({ receipt, processInstanceId: instanceA }),
    ).not.toBe(hashBallotReceipt({ receipt, processInstanceId: instanceB }));
  });

  it('reads the instance id case-insensitively', () => {
    const receipt = createBallotReceipt();

    expect(hashBallotReceipt({ receipt, processInstanceId: instanceA })).toBe(
      hashBallotReceipt({
        receipt,
        processInstanceId: instanceA.toUpperCase(),
      }),
    );
  });

  it('cannot be told from the seal key', () => {
    const receipt = createBallotReceipt();
    const hash = hashBallotReceipt({ receipt, processInstanceId: instanceA });
    const seal = sealBallot({ receipt, processInstanceId: instanceA, picks });

    expect(hash).toHaveLength(64);
    expect(seal).toHaveLength(64);
    expect(hash).not.toBe(seal);
  });
});

describe('sealBallot', () => {
  it('seals the same picks the same whatever order they are read in', () => {
    const receipt = createBallotReceipt();

    expect(
      sealBallot({
        receipt,
        processInstanceId: instanceA,
        picks: [...picks].reverse(),
      }),
    ).toBe(sealBallot({ receipt, processInstanceId: instanceA, picks }));
  });

  it('verifies the picks that were sealed', () => {
    const receipt = createBallotReceipt();
    const seal = sealBallot({ receipt, processInstanceId: instanceA, picks });

    expect(
      isBallotSealIntact({
        receipt,
        processInstanceId: instanceA,
        picks,
        seal,
      }),
    ).toBe(true);
  });

  it.each([
    [
      'a swapped proposal',
      [{ ...picks[0]!, proposalId: picks[1]!.proposalId }, picks[1]!],
    ],
    [
      'a changed rank',
      [
        { ...picks[0]!, rank: 2 },
        { ...picks[1]!, rank: 1 },
      ],
    ],
    ['a dropped pick', [picks[0]!]],
    ['an added pick', [...picks, { ...picks[1]!, position: 2, rank: 3 }]],
  ])('rejects %s', (_, changed) => {
    const receipt = createBallotReceipt();
    const seal = sealBallot({ receipt, processInstanceId: instanceA, picks });

    expect(
      isBallotSealIntact({
        receipt,
        processInstanceId: instanceA,
        picks: changed,
        seal,
      }),
    ).toBe(false);
  });

  it('rejects a seal made under another receipt or instance', () => {
    const receipt = createBallotReceipt();
    const seal = sealBallot({ receipt, processInstanceId: instanceA, picks });

    expect(
      isBallotSealIntact({
        receipt: createBallotReceipt(),
        processInstanceId: instanceA,
        picks,
        seal,
      }),
    ).toBe(false);
    expect(
      isBallotSealIntact({
        receipt,
        processInstanceId: instanceB,
        picks,
        seal,
      }),
    ).toBe(false);
  });

  it('rejects a malformed seal without throwing', () => {
    const receipt = createBallotReceipt();

    expect(
      isBallotSealIntact({
        receipt,
        processInstanceId: instanceA,
        picks,
        seal: 'not-hex',
      }),
    ).toBe(false);
  });
});
