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
    expect(decisionPermission.MANAGE_PROCESS).toBe(32);
    expect(decisionPermission.INVITE_MEMBERS).toBe(64);
    expect(decisionPermission.REVIEW).toBe(128);
    expect(decisionPermission.SUBMIT_PROPOSALS).toBe(256);
    expect(decisionPermission.VOTE).toBe(512);
  });

  it('should not overlap with ACRUD bits', () => {
    const allDecisionBits =
      decisionPermission.MANAGE_PROCESS |
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
      manageProcess: false,
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
        manageProcess: true,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(32);

    expect(
      toDecisionBitField({
        manageProcess: false,
        inviteMembers: true,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(64);

    expect(
      toDecisionBitField({
        manageProcess: false,
        inviteMembers: false,
        review: true,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(128);

    expect(
      toDecisionBitField({
        manageProcess: false,
        inviteMembers: false,
        review: false,
        submitProposals: true,
        vote: false,
      }),
    ).toBe(256);

    expect(
      toDecisionBitField({
        manageProcess: false,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: true,
      }),
    ).toBe(512);
  });

  it('should combine multiple bits correctly', () => {
    const caps: DecisionCapabilities = {
      manageProcess: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    };
    // 32 + 64 + 128 + 256 + 512 = 992
    expect(toDecisionBitField(caps)).toBe(992);
  });

  it('should combine a subset of bits correctly', () => {
    const caps: DecisionCapabilities = {
      manageProcess: false,
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
      manageProcess: false,
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });
  });

  it('should return all true for 992 (all bits set)', () => {
    expect(fromDecisionBitField(992)).toEqual({
      manageProcess: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    });
  });

  it('should extract decision bits and ignore ACRUD bits', () => {
    // ACRUD bits (create=8, read=4) + decision bits (REVIEW=128, VOTE=512) = 12 + 640 = 652
    const bitfield = 8 | 4 | 128 | 512;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      manageProcess: false,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    });
  });

  it('should round-trip correctly with toDecisionBitField', () => {
    const original: DecisionCapabilities = {
      manageProcess: true,
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
      manageProcess: false,
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
