import type { Proposal, ProposalTemplateSchema } from '@op/common/client';

/** The template `getProposal` resolved for the proposal (its form row, else the instance's), typed for the editor. */
export function getProposalTemplate(
  proposal: Pick<Proposal, 'proposalTemplate'>,
): ProposalTemplateSchema | null {
  return isProposalTemplate(proposal.proposalTemplate)
    ? proposal.proposalTemplate
    : null;
}

function isProposalTemplate(value: unknown): value is ProposalTemplateSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
