import { ProposalRelationshipType } from '@op/db/schema';
import { z } from 'zod';

import { moneyAmountSchema } from '../../../money';

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

/**
 * The far proposal's submitter, as rendered on a relationship card's facepile.
 * Deliberately narrower than `proposalProfileSchema`: the card shows the name
 * and avatar as plain text — the card's only link is its title — so there is no
 * profile link to gate on the submitter's anonymity.
 */
export const proposalRelationshipAuthorSchema = z.object({
  name: z.string(),
  /** Storage object name, resolved to a public URL by the client. */
  avatarImageName: z.string().nullish(),
});

export type ProposalRelationshipAuthor = z.infer<
  typeof proposalRelationshipAuthorSchema
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
    /**
     * Budget and categories from the creation-time `proposalData` snapshot, so
     * a relationship card carries the same badges as a proposal card. Unlike
     * the list surfaces these aren't re-resolved from the live document — a
     * merged-away proposal is frozen in practice, and a fan-in of them isn't
     * worth a fragment fetch each.
     */
    budget: moneyAmountSchema.nullish(),
    categories: z.array(z.string()),
    submittedBy: proposalRelationshipAuthorSchema.nullish(),
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
