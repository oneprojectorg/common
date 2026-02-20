/**
 * Decision-specific permission capabilities using higher bits (5–9).
 * These extend the standard ACRUD bits (0–4) from access-zones.
 *
 * Bit 5 (32)  — Manage Process
 * Bit 6 (64)  — Invite Members
 * Bit 7 (128) — Review
 * Bit 8 (256) — Submit Proposals
 * Bit 9 (512) — Vote
 */
export const decisionPermission = {
  MANAGE_PROCESS: 32,
  INVITE_MEMBERS: 64,
  REVIEW: 128,
  SUBMIT_PROPOSALS: 256,
  VOTE: 512,
} as const;

export type DecisionCapabilities = {
  manageProcess: boolean;
  inviteMembers: boolean;
  review: boolean;
  submitProposals: boolean;
  vote: boolean;
};

/** Mask covering only decision bits (5–9) */
const DECISION_BITS_MASK =
  decisionPermission.MANAGE_PROCESS |
  decisionPermission.INVITE_MEMBERS |
  decisionPermission.REVIEW |
  decisionPermission.SUBMIT_PROPOSALS |
  decisionPermission.VOTE; // 0x3E0 = 992

/** Mask covering only ACRUD bits (0–4) */
export const ACRUD_BITS_MASK = 31; // 0x1F

/** Convert a DecisionCapabilities object into a bitfield (bits 5–9 only). */
export function toDecisionBitField(caps: DecisionCapabilities): number {
  let bits = 0;
  if (caps.manageProcess) {
    bits |= decisionPermission.MANAGE_PROCESS;
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

/** Extract decision capabilities (bits 5–9) from a raw permission bitfield. */
export function fromDecisionBitField(bitField: number): DecisionCapabilities {
  const masked = bitField & DECISION_BITS_MASK;
  return {
    manageProcess: (masked & decisionPermission.MANAGE_PROCESS) !== 0,
    inviteMembers: (masked & decisionPermission.INVITE_MEMBERS) !== 0,
    review: (masked & decisionPermission.REVIEW) !== 0,
    submitProposals: (masked & decisionPermission.SUBMIT_PROPOSALS) !== 0,
    vote: (masked & decisionPermission.VOTE) !== 0,
  };
}

export const DECISION_PERMISSION_LABELS: Record<
  keyof DecisionCapabilities,
  string
> = {
  manageProcess: 'Manage Process',
  inviteMembers: 'Invite Members',
  review: 'Review',
  submitProposals: 'Submit Proposals',
  vote: 'Vote',
};
