import { ProposalRelationshipType } from '@op/db/schema';
import { z } from 'zod';

import { list } from '../../../utils/pagination';

/** The column is `text`, so this is the only ceiling; raising it needs no migration. */
export const MERGE_NOTE_MAX_LENGTH = 2000;

/**
 * Reads as "source merges into target": the source is superseded and hidden, the
 * target survives.
 */
export const mergeProposalsInputSchema = z.object({
  sourceProposalId: z.uuid(),
  targetProposalId: z.uuid(),
  /** Blank normalizes to `undefined` so it stores NULL, not an empty note. */
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
 * leaves "the other end" undefined, pinning neither asks for every edge in the
 * database.
 */
export const listProposalRelationshipsInputSchema = z
  .object({
    sourceProposalId: z.uuid().optional(),
    targetProposalId: z.uuid().optional(),
    /** Only edges of this type. Absent means every type. */
    relationshipType: z.enum(ProposalRelationshipType).optional(),
  })
  .refine(
    (input) =>
      Boolean(input.sourceProposalId) !== Boolean(input.targetProposalId),
    { message: 'Pass exactly one of sourceProposalId or targetProposalId' },
  );

export type ListProposalRelationshipsInput = z.infer<
  typeof listProposalRelationshipsInputSchema
>;

/** The proposal at the other end of a relationship, as the list read returns it. */
export const relatedProposalSchema = z.object({
  id: z.uuid(),
  status: z.string().nullish(),
  profile: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
});

export type RelatedProposal = z.infer<typeof relatedProposalSchema>;

export const proposalRelationshipItemSchema = z.object({
  id: z.uuid(),
  relationshipType: z.enum(ProposalRelationshipType),
  createdAt: z.string().nullish(),
  /** The proposal at the end the caller did NOT pin. */
  proposal: relatedProposalSchema,
});

export type ProposalRelationshipItem = z.infer<
  typeof proposalRelationshipItemSchema
>;

export const proposalRelationshipListSchema = list(
  proposalRelationshipItemSchema,
);

export type ProposalRelationshipList = z.infer<
  typeof proposalRelationshipListSchema
>;
