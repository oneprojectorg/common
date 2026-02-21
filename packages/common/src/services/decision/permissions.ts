/**
 * Decision permission capabilities.
 *
 * `admin` maps to the standard ACRUD admin bit (bit 4, value 16) and is
 * surfaced in the role editor as "Manage Process".
 *
 * Higher bits (6–9) extend the standard ACRUD bits (0–4) from access-zones:
 * Bit 6 (64)  — Invite Members
 * Bit 7 (128) — Review
 * Bit 8 (256) — Submit Proposals
 * Bit 9 (512) — Vote
 */
export const decisionPermission = {
  INVITE_MEMBERS: 64,
  REVIEW: 128,
  SUBMIT_PROPOSALS: 256,
  VOTE: 512,
} as const;

/** ACRUD admin bit from access-zones (bit 4) */
const ADMIN_BIT = 16;

export type DecisionCapabilities = {
  admin: boolean;
  inviteMembers: boolean;
  review: boolean;
  submitProposals: boolean;
  vote: boolean;
};

/** Mask covering only CRUD bits (0–3), excluding admin which is managed via capabilities */
export const CRUD_BITS_MASK = 15; // 0x0F

/**
 * Convert a DecisionCapabilities object into a bitfield.
 * Produces admin bit (4) + decision bits (6–9).
 */
export function toDecisionBitField(caps: DecisionCapabilities): number {
  let bits = 0;
  if (caps.admin) {
    bits |= ADMIN_BIT;
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
 * Extract decision capabilities from a raw permission bitfield.
 * Reads admin bit (4) + decision bits (6–9).
 */
export function fromDecisionBitField(bitField: number): DecisionCapabilities {
  return {
    admin: (bitField & ADMIN_BIT) !== 0,
    inviteMembers: (bitField & decisionPermission.INVITE_MEMBERS) !== 0,
    review: (bitField & decisionPermission.REVIEW) !== 0,
    submitProposals: (bitField & decisionPermission.SUBMIT_PROPOSALS) !== 0,
    vote: (bitField & decisionPermission.VOTE) !== 0,
  };
}

export const DECISION_PERMISSION_LABELS: Record<
  keyof DecisionCapabilities,
  string
> = {
  admin: 'Manage Process',
  inviteMembers: 'Invite Members',
  review: 'Review',
  submitProposals: 'Submit Proposals',
  vote: 'Vote',
};
