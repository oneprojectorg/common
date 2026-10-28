import { checkPermission, collapseRoles, permission } from 'access-zones';
import type { NormalizedRole } from 'access-zones';

/**
 * Decision permission capabilities.
 *
 * `admin` maps to the standard ACRUD admin bit (bit 4, value 16) and is
 * surfaced in the role editor as "Manage Process".
 *
 * Higher bits (5–8) extend the standard ACRUD bits (0–4) from access-zones:
 * Bit 5 (32)  — Invite Members
 * Bit 6 (64)  — Review
 * Bit 7 (128) — Submit Proposals
 * Bit 8 (256) — Vote
 */
export const decisionPermission = {
  INVITE_MEMBERS: 0b1_00000,
  REVIEW: 0b10_00000,
  SUBMIT_PROPOSALS: 0b100_00000,
  VOTE: 0b1000_00000,
} as const;

/**
 * Who administers a decision: an admin of its profile, or a role with
 * "Manage Process".
 */
export const decisionAdminPermissions = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
];

export type DecisionRolePermissions = {
  delete: boolean;
  update: boolean;
  read: boolean;
  create: boolean;
  admin: boolean;
  inviteMembers: boolean;
  review: boolean;
  submitProposals: boolean;
  vote: boolean;
};

/** Mask covering only CRUD bits (0–3), excluding admin which is managed via capabilities */
export const CRUD_BITS_MASK = 0b1111;

/**
 * Convert a DecisionRolePermissions object into a bitfield.
 * Produces ACRUD bits (0–4) + decision bits (5–8).
 */
export function toDecisionBitField(caps: DecisionRolePermissions): number {
  let bits = 0;
  if (caps.delete) {
    bits |= permission.DELETE;
  }
  if (caps.update) {
    bits |= permission.UPDATE;
  }
  if (caps.read) {
    bits |= permission.READ;
  }
  if (caps.create) {
    bits |= permission.CREATE;
  }
  if (caps.admin) {
    bits |= permission.ADMIN;
  }
  if (caps.inviteMembers) {
    bits |= decisionPermission.INVITE_MEMBERS;
  }
  if (caps.review) {
    bits |= decisionPermission.REVIEW;
  }
  if (caps.submitProposals) {
    bits |= decisionPermission.SUBMIT_PROPOSALS;
  }
  if (caps.vote) {
    bits |= decisionPermission.VOTE;
  }
  return bits;
}

/**
 * Extract all capabilities from a raw permission bitfield.
 * Reads ACRUD bits (0–4) + decision bits (5–8).
 */
export function fromDecisionBitField(
  bitField: number,
): DecisionRolePermissions {
  return {
    delete: (bitField & permission.DELETE) !== 0,
    update: (bitField & permission.UPDATE) !== 0,
    read: (bitField & permission.READ) !== 0,
    create: (bitField & permission.CREATE) !== 0,
    admin: (bitField & permission.ADMIN) !== 0,
    inviteMembers: (bitField & decisionPermission.INVITE_MEMBERS) !== 0,
    review: (bitField & decisionPermission.REVIEW) !== 0,
    submitProposals: (bitField & decisionPermission.SUBMIT_PROPOSALS) !== 0,
    vote: (bitField & decisionPermission.VOTE) !== 0,
  };
}

export const getRolesDecisionBits = (roles: NormalizedRole[]): number =>
  collapseRoles(roles)['decisions'] ?? 0;

const ALL_TRUE_ACCESS: DecisionRolePermissions = {
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

/** Capabilities from the caller's roles on the decision's profile. */
export function resolveDecisionAccess(
  profileRoles: NormalizedRole[],
): DecisionRolePermissions {
  // Profile admins bypass decision-zone role checks — they have full access
  if (checkPermission({ profile: permission.ADMIN }, profileRoles)) {
    return ALL_TRUE_ACCESS;
  }
  return fromDecisionBitField(getRolesDecisionBits(profileRoles));
}
