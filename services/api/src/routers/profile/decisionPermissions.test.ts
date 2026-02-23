import {
  CRUD_BITS_MASK,
  type DecisionRolePermissions,
  decisionPermission,
  fromDecisionBitField,
  toDecisionBitField,
} from '@op/common';
import { permission } from 'access-zones';
import { describe, expect, it } from 'vitest';

describe('decisionPermission constants', () => {
  it('should have the correct bit values', () => {
    expect(decisionPermission.INVITE_MEMBERS).toBe(32);
    expect(decisionPermission.REVIEW).toBe(64);
    expect(decisionPermission.SUBMIT_PROPOSALS).toBe(128);
    expect(decisionPermission.VOTE).toBe(256);
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
      delete: false,
      update: false,
      read: false,
      create: false,
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
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: true,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(permission.ADMIN);
  });

  it('should set individual decision bits correctly', () => {
    expect(
      toDecisionBitField({
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: true,
        review: false,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(decisionPermission.INVITE_MEMBERS);

    expect(
      toDecisionBitField({
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: false,
        review: true,
        submitProposals: false,
        vote: false,
      }),
    ).toBe(decisionPermission.REVIEW);

    expect(
      toDecisionBitField({
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: true,
        vote: false,
      }),
    ).toBe(decisionPermission.SUBMIT_PROPOSALS);

    expect(
      toDecisionBitField({
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: true,
      }),
    ).toBe(decisionPermission.VOTE);
  });

  it('should combine all bits correctly', () => {
    const caps: DecisionRolePermissions = {
      delete: true,
      update: true,
      read: true,
      create: true,
      admin: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    };
    expect(toDecisionBitField(caps)).toBe(
      permission.DELETE |
        permission.UPDATE |
        permission.READ |
        permission.CREATE |
        permission.ADMIN |
        decisionPermission.INVITE_MEMBERS |
        decisionPermission.REVIEW |
        decisionPermission.SUBMIT_PROPOSALS |
        decisionPermission.VOTE,
    );
  });

  it('should combine a subset of bits correctly', () => {
    const caps: DecisionRolePermissions = {
      delete: false,
      update: false,
      read: false,
      create: false,
      admin: false,
      inviteMembers: true,
      review: true,
      submitProposals: false,
      vote: true,
    };
    expect(toDecisionBitField(caps)).toBe(
      decisionPermission.INVITE_MEMBERS |
        decisionPermission.REVIEW |
        decisionPermission.VOTE,
    );
  });
});

describe('fromDecisionBitField', () => {
  it('should return all false for 0', () => {
    expect(fromDecisionBitField(0)).toEqual({
      delete: false,
      update: false,
      read: false,
      create: false,
      admin: false,
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });
  });

  it('should return all true when all bits set', () => {
    const allBits =
      permission.DELETE |
      permission.UPDATE |
      permission.READ |
      permission.CREATE |
      permission.ADMIN |
      decisionPermission.INVITE_MEMBERS |
      decisionPermission.REVIEW |
      decisionPermission.SUBMIT_PROPOSALS |
      decisionPermission.VOTE;

    expect(fromDecisionBitField(allBits)).toEqual({
      delete: true,
      update: true,
      read: true,
      create: true,
      admin: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    });
  });

  it('should extract all bits including CRUD', () => {
    const bitfield =
      permission.CREATE |
      permission.READ |
      decisionPermission.REVIEW |
      decisionPermission.VOTE;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      delete: false,
      update: false,
      read: true,
      create: true,
      admin: false,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: true,
    });
  });

  it('should extract admin bit when present', () => {
    const bitfield = permission.ADMIN | decisionPermission.REVIEW;
    const result = fromDecisionBitField(bitfield);

    expect(result).toEqual({
      delete: false,
      update: false,
      read: false,
      create: false,
      admin: true,
      inviteMembers: false,
      review: true,
      submitProposals: false,
      vote: false,
    });
  });

  it('should round-trip correctly with toDecisionBitField', () => {
    const original: DecisionRolePermissions = {
      delete: false,
      update: false,
      read: true,
      create: false,
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
});
