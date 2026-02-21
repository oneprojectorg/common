import {
  ACRUD_BITS_MASK,
  type DecisionCapabilities,
  decisionPermission,
  fromDecisionBitField,
  toDecisionBitField,
} from '@op/common';
import { describe, expect, it } from 'vitest';

describe('decisionPermission constants', () => {
  it('should have the correct bit values', () => {
    expect(decisionPermission.INVITE_MEMBERS).toBe(64);
    expect(decisionPermission.REVIEW).toBe(128);
    expect(decisionPermission.SUBMIT_PROPOSALS).toBe(256);
    expect(decisionPermission.VOTE).toBe(512);
  });

  it('should not overlap with ACRUD bits', () => {
    const allDecisionBits =
      decisionPermission.INVITE_MEMBERS |
      decisionPermission.REVIEW |
      decisionPermission.SUBMIT_PROPOSALS |
      decisionPermission.VOTE;

    // No overlap with ACRUD mask (bits 0–4)
    expect(allDecisionBits & ACRUD_BITS_MASK).toBe(0);
  });
});

describe('toDecisionBitField', () => {
  it('should return 0 when all capabilities are false', () => {
    const caps: DecisionCapabilities = {
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    };
    expect(toDecisionBitField(caps)).toBe(0);
  });

  it('should set individual bits correctly', () => {
    expect(
      toDecisionBitField({
        inviteMembers: true,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(64);

    expect(
      toDecisionBitField({
        inviteMembers: false,
        review: true,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(128);

    expect(
      toDecisionBitField({
        inviteMembers: false,
        review: false,
        submitProposals: true,
        vote: false,
      }),
    ).toBe(256);

    expect(
      toDecisionBitField({
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: true,
      }),
    ).toBe(512);
  });

  it('should combine multiple bits correctly', () => {
    const caps: DecisionCapabilities = {
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    };
    // 64 + 128 + 256 + 512 = 960
    expect(toDecisionBitField(caps)).toBe(960);
  });

  it('should combine a subset of bits correctly', () => {
    const caps: DecisionCapabilities = {
      inviteMembers: true,
      review: true,
      submitProposals: false,
      vote: true,
    };
    // 64 + 128 + 512 = 704
    expect(toDecisionBitField(caps)).toBe(704);
  });
});

describe('fromDecisionBitField', () => {
  it('should return all false for 0', () => {
    expect(fromDecisionBitField(0)).toEqual({
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });
  });

  it('should return all true for 960 (all bits set)', () => {
    expect(fromDecisionBitField(960)).toEqual({
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    });
  });

  it('should extract decision bits and ignore ACRUD bits', () => {
    // ACRUD bits (create=8, read=4) + decision bits (REVIEW=128, VOTE=512)
    const bitfield = 8 | 4 | 128 | 512;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    });
  });

  it('should round-trip correctly with toDecisionBitField', () => {
    const original: DecisionCapabilities = {
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    };

    const bitfield = toDecisionBitField(original);
    const roundTripped = fromDecisionBitField(bitfield);

    expect(roundTripped).toEqual(original);
  });

  it('should round-trip correctly even with ACRUD bits present', () => {
    const original: DecisionCapabilities = {
      inviteMembers: true,
      review: false,
      submitProposals: true,
      vote: false,
    };

    // Combine with ACRUD bits (admin=16, read=4)
    const bitfield = toDecisionBitField(original) | 16 | 4;
    const roundTripped = fromDecisionBitField(bitfield);

    expect(roundTripped).toEqual(original);
  });
});
