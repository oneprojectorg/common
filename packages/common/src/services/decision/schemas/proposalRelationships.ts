import { ProposalRelationshipType } from '@op/db/schema';
import { z } from 'zod';

/**
 * Cap on the merge note, in characters.
 *
 * The column is `text`, so this is the only ceiling — raising it needs no
 * migration. Sized for a paragraph of rationale that reads cleanly in an email,
 * not for pasted proposal content.
 */
export const MERGE_NOTE_MAX_LENGTH = 2000;

/**
 * Reads as "source merges into target": the source is superseded and hidden, the
 * target survives.
 */
export const mergeProposalsInputSchema = z.object({
  sourceProposalId: z.uuid(),
  targetProposalId: z.uuid(),
  /**
   * Why the merge happened, shown to the superseded proposal's author. Trimmed
   * and normalized to `undefined` when blank, so a whitespace-only textarea
   * stores NULL rather than an empty string that reads as "a note was written".
   */
  note: z
    .string()
    .trim()
    .max(MERGE_NOTE_MAX_LENGTH)
    .optional()
    .transform((value) => value || undefined),
});

export type MergeProposalsInput = z.infer<typeof mergeProposalsInputSchema>;

export const unmergeProposalInputSchema = z.object({
  sourceProposalId: z.uuid(),
});

export type UnmergeProposalInput = z.infer<typeof unmergeProposalInputSchema>;

/**
 * Direction comes from which end the caller pins. Exactly one: pinning both
 * leaves "the other end" undefined, pinning neither asks for every merge in the
 * database.
 */
export const listProposalRelationshipsInputSchema = z
  .object({
    sourceProposalId: z.uuid().optional(),
    targetProposalId: z.uuid().optional(),
  })
  .refine(
    (input) =>
      Boolean(input.sourceProposalId) !== Boolean(input.targetProposalId),
    { message: 'Pass exactly one of sourceProposalId or targetProposalId' },
  );

export type ListProposalRelationshipsInput = z.infer<
  typeof listProposalRelationshipsInputSchema
>;

export const proposalRelationshipItemSchema = z.object({
  id: z.uuid(),
  relationshipType: z.enum(ProposalRelationshipType),
  createdAt: z.string().nullish(),
  /** The proposal at the end the caller did NOT pin. */
  proposal: z.object({
    id: z.uuid(),
    status: z.string().nullish(),
    profile: z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
    }),
  }),
});

export type ProposalRelationshipItem = z.infer<
  typeof proposalRelationshipItemSchema
>;

export const proposalRelationshipListSchema = z.object({
  relationships: z.array(proposalRelationshipItemSchema),
});

export type ProposalRelationshipList = z.infer<
  typeof proposalRelationshipListSchema
>;
