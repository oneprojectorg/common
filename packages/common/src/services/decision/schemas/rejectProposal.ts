import { RejectionReason } from '@op/core/decisions';
import { z } from 'zod';

/** Nothing stores the note, so this only bounds what the email can carry. */
export const REJECTION_NOTE_MAX_LENGTH = 2000;

// The values live in `@op/core` because `@op/events` and `@op/emails` need them
// too and neither can depend on this package. Re-exported so the dialog and the
// mutation still reach the reason and its schema through one import.
export { RejectionReason };

export const rejectionReasonSchema = z.enum(RejectionReason);

export const rejectProposalInputSchema = z.object({
  proposalId: z.uuid(),
  reason: rejectionReasonSchema,
  /** Blank normalizes to `undefined` so the email omits the note entirely. */
  note: z
    .string()
    .trim()
    .max(REJECTION_NOTE_MAX_LENGTH)
    .optional()
    .transform((value) => value || undefined),
});

export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;

/** Undo carries no reason, so it can't share the reject input. */
export const unrejectProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export type UnrejectProposalInput = z.infer<typeof unrejectProposalInputSchema>;
