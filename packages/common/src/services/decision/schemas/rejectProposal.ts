import { z } from 'zod';

/** The note column is `text`, so this is the only ceiling; matches merge's note. */
export const REJECTION_NOTE_MAX_LENGTH = 2000;

/**
 * Why an admin rejected a proposal. Kept as a client-defined union for now
 * because there is no storage for it yet (see ONE-931): the reject endpoint
 * validates and reports the reason, but where it is persisted — and whether it
 * becomes a Postgres enum — is the open architectural question this work defers.
 */
export const PROPOSAL_REJECTION_REASONS = [
  'ineligible',
  'duplicate',
  'off_topic',
  'infeasible',
] as const;

export type ProposalRejectionReason =
  (typeof PROPOSAL_REJECTION_REASONS)[number];

export const rejectProposalInputSchema = z.object({
  proposalId: z.uuid(),
  reason: z.enum(PROPOSAL_REJECTION_REASONS),
  /** Blank normalizes to `undefined` so it stores NULL, not an empty note. */
  note: z
    .string()
    .trim()
    .max(REJECTION_NOTE_MAX_LENGTH)
    .optional()
    .transform((value) => value || undefined),
});

export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;
