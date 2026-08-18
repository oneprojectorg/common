import { ProposalRelationshipType } from '@op/db/schema';
import { z } from 'zod';

/**
 * Reads as "source merges into target": the source is superseded and hidden, the
 * target survives.
 */
export const mergeProposalsInputSchema = z.object({
  sourceProposalId: z.uuid(),
  targetProposalId: z.uuid(),
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
