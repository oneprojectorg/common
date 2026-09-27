import { describe, expect, it } from 'vitest';

import {
  REJECTION_NOTE_MAX_LENGTH,
  RejectionReason,
  rejectProposalInputSchema,
  unrejectProposalInputSchema,
} from './rejectProposal';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';

describe('rejectProposalInputSchema', () => {
  it('accepts every reason the enum declares', () => {
    for (const reason of Object.values(RejectionReason)) {
      expect(
        rejectProposalInputSchema.parse({ proposalId: PROPOSAL_ID, reason }),
      ).toEqual({ proposalId: PROPOSAL_ID, reason, note: undefined });
    }
  });

  // The dialog offers these in declaration order, so the order is load-bearing.
  it('declares the reasons in the order the dialog offers them', () => {
    expect(Object.values(RejectionReason)).toEqual([
      'ineligible',
      'duplicate',
      'off-topic',
      'infeasible',
    ]);
  });

  // The dialog disables submit until a reason is picked; this is the other half.
  it('rejects a missing or unknown reason', () => {
    expect(
      rejectProposalInputSchema.safeParse({ proposalId: PROPOSAL_ID }).success,
    ).toBe(false);
    expect(
      rejectProposalInputSchema.safeParse({
        proposalId: PROPOSAL_ID,
        reason: 'because-i-said-so',
      }).success,
    ).toBe(false);
  });

  // Nothing stores the note, so an empty one must not reach the email as "".
  it('normalizes a blank note to undefined', () => {
    expect(
      rejectProposalInputSchema.parse({
        proposalId: PROPOSAL_ID,
        reason: RejectionReason.DUPLICATE,
        note: '   ',
      }).note,
    ).toBeUndefined();
  });

  it('trims a note and caps its length', () => {
    expect(
      rejectProposalInputSchema.parse({
        proposalId: PROPOSAL_ID,
        reason: RejectionReason.DUPLICATE,
        note: '  Already covered by #12.  ',
      }).note,
    ).toBe('Already covered by #12.');

    expect(
      rejectProposalInputSchema.safeParse({
        proposalId: PROPOSAL_ID,
        reason: RejectionReason.DUPLICATE,
        note: 'x'.repeat(REJECTION_NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});

describe('unrejectProposalInputSchema', () => {
  // It used to alias the reject input; undo has no reason to give.
  it('takes only the proposal id', () => {
    expect(
      unrejectProposalInputSchema.parse({
        proposalId: PROPOSAL_ID,
        reason: RejectionReason.DUPLICATE,
      }),
    ).toEqual({ proposalId: PROPOSAL_ID });
  });
});
