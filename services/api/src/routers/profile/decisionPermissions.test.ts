import {
  CRUD_BITS_MASK,
  type DecisionRolePermissions,
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

  it('should not overlap with CRUD bits', () => {
    const allDecisionBits =
      decisionPermission.INVITE_MEMBERS |
      decisionPermission.REVIEW |
      decisionPermission.SUBMIT_PROPOSALS |
      decisionPermission.VOTE;

    // No overlap with CRUD mask (bits 0–3)
    expect(allDecisionBits & CRUD_BITS_MASK).toBe(0);
  });
});

describe('toDecisionBitField', () => {
  it('should return 0 when all capabilities are false', () => {
    const caps: DecisionRolePermissions = {
      admin: false,
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    };
    expect(toDecisionBitField(caps)).toBe(0);
  });

  it('should set the admin bit correctly', () => {
    expect(
      toDecisionBitField({
        admin: true,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(16);
  });

  it('should set individual decision bits correctly', () => {
    expect(
      toDecisionBitField({
        admin: false,
        inviteMembers: true,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(64);

    expect(
      toDecisionBitField({
        admin: false,
        inviteMembers: false,
        review: true,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(128);

    expect(
      toDecisionBitField({
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: true,
        vote: false,
      }),
    ).toBe(256);

    expect(
      toDecisionBitField({
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: true,
      }),
    ).toBe(512);
  });

  it('should combine all bits correctly', () => {
    const caps: DecisionRolePermissions = {
      admin: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    };
    // 16 + 64 + 128 + 256 + 512 = 976
    expect(toDecisionBitField(caps)).toBe(976);
  });

  it('should combine a subset of bits correctly', () => {
    const caps: DecisionRolePermissions = {
      admin: false,
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
      admin: false,
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });
  });

  it('should return all true for 976 (all bits set)', () => {
    expect(fromDecisionBitField(976)).toEqual({
      admin: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    });
  });

  it('should extract admin and decision bits, ignoring CRUD bits', () => {
    // CRUD bits (create=8, read=4) + decision bits (REVIEW=128, VOTE=512)
    const bitfield = 8 | 4 | 128 | 512;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      admin: false,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    });
  });

  it('should extract admin bit when present', () => {
    // admin=16 + REVIEW=128
    const bitfield = 16 | 128;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      admin: true,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: false,
    });
  });

  it('should round-trip correctly with toDecisionBitField', () => {
    const original: DecisionRolePermissions = {
      admin: true,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    };

    const bitfield = toDecisionBitField(original);
    const roundTripped = fromDecisionBitField(bitfield);

    expect(roundTripped).toEqual(original);
  });

  it('should round-trip correctly even with CRUD bits present', () => {
    const original: DecisionRolePermissions = {
      admin: false,
      inviteMembers: true,
      review: false,
      submitProposals: true,
      vote: false,
    };

    // Combine with CRUD bits (create=8, read=4) — admin is NOT set
    const bitfield = toDecisionBitField(original) | 8 | 4;
    const roundTripped = fromDecisionBitField(bitfield);

    expect(roundTripped).toEqual(original);
  });
});
