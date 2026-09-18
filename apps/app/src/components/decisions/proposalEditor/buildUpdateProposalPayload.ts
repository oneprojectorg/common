import {
  type BudgetData,
  type Proposal,
  type ProposalDataInput,
  type XFormatPropertySchema,
  parseProposalData,
} from '@op/common/client';

import { resolveProposalCategory } from './resolveProposalCategory';

interface CurrentDraft {
  title: string;
  category: string[];
  budget: BudgetData | null;
}

/**
 * Builds the `updateProposal` mutation payload from the local draft state.
 *
 * A non-draft update is a checkpoint: it re-validates against the template
 * (and, for collab proposals, against TipTap Cloud) the same way `submitProposal`
 * does, so edits after submission still enforce required fields.
 */
export function buildUpdateProposalPayload({
  proposal,
  currentDraft,
  collaborationDocId,
  categorySchema,
  isDraft,
}: {
  proposal: Pick<Proposal, 'id' | 'proposalData'>;
  currentDraft: CurrentDraft;
  collaborationDocId: string;
  categorySchema: XFormatPropertySchema | undefined;
  isDraft: boolean;
}) {
  const proposalData: ProposalDataInput = {
    ...parseProposalData(proposal.proposalData),
    collaborationDocId,
    category: resolveProposalCategory(categorySchema, currentDraft.category),
    budget: currentDraft.budget ?? undefined,
  };

  return {
    proposalId: proposal.id,
    data: {
      title: currentDraft.title,
      proposalData,
      ...(!isDraft ? { checkpointVersion: { type: 'update' as const } } : {}),
    },
  };
}
