import { z } from 'zod';

/** Nothing stores the note, so this only bounds what the email can carry. */
export const REJECTION_NOTE_MAX_LENGTH = 2000;

/**
 * Why an admin rejected a proposal. Declaration order is the order the reject
 * dialog offers them in. No pg enum behind it: neither the reason nor the note
 * is persisted yet — both exist to be delivered in the rejection email.
 */
export enum RejectionReason {
  INELIGIBLE = 'ineligible',
  DUPLICATE = 'duplicate',
  OFF_TOPIC = 'off-topic',
  INFEASIBLE = 'infeasible',
}

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
