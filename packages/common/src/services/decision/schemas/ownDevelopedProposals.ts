import { z } from 'zod';

import { moneyAmountSchema } from '../../../money';
import { paginated, paginationInput, total } from '../../../utils/pagination';
import { proposalSearchSchema } from './proposal';

/**
 * Whose entries a develop screen lists:
 * - `own`: the caller's entries, drafts included. The default.
 * - `all`: every ready entry of the phase, whoever wrote it. Admin only.
 */
export const developedEntryScopeSchema = z.enum(['own', 'all']);

export type DevelopedEntryScope = z.infer<typeof developedEntryScopeSchema>;

export const listOwnDevelopedProposalsInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    scope: developedEntryScopeSchema.prefault('own'),
    /** Narrows either scope to the entries linked to one category. */
    categoryId: z.uuid().optional(),
    /** Every word in the entry's title, or in one of its origins' titles. */
    search: proposalSearchSchema,
  })
  .extend(paginationInput('md').shape);

export type ListOwnDevelopedProposalsInput = z.input<
  typeof listOwnDevelopedProposalsInputSchema
>;

/** A proposal an entry was developed from: the source of a `developed` edge. */
export const developedOriginSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/**
 * A developed proposal in the current phase. Slim: what the
 * develop screen lists, with the title and budget resolved from the document.
 */
export const ownDevelopedProposalSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  status: z.string().nullish(),
  visibility: z.string(),
  createdAt: z.string().nullish(),
  title: z.string(),
  category: z.array(z.string()),
  budget: moneyAmountSchema.nullable(),
  origins: z.array(developedOriginSchema),
});

export type OwnDevelopedProposal = z.infer<typeof ownDevelopedProposalSchema>;

/**
 * One page of entries, newest first. The counts and the budget
 * total cover every entry the search matches, not just this page.
 */
export const ownDevelopedProposalListSchema = paginated(
  ownDevelopedProposalSchema,
).extend({
  total,
  /** Entries marked ready (no longer drafts). */
  readyTotal: total,
  /**
   * The sum of the entries' stored budgets, or null when there is none or
   * their currencies differ.
   */
  budgetTotal: moneyAmountSchema.nullable(),
});

export type OwnDevelopedProposalList = z.infer<
  typeof ownDevelopedProposalListSchema
>;
