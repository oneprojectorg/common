import type { Proposal, ProposalTemplateSchema } from '@op/common/client';

/**
 * The template the editor renders and validates a proposal against.
 *
 * The proposal's own template comes first: `getProposal` resolves it from the
 * proposal's form schema row, then the instance. A proposal with no row of its
 * own resolves to the instance template, so an ordinary proposal gets the same
 * fields as before. The instance template is the fallback for a proposal read
 * that does not carry a template.
 */
export function getProposalEditorTemplate({
  proposal,
  instanceTemplate,
}: {
  proposal: Pick<Proposal, 'proposalTemplate'>;
  instanceTemplate: ProposalTemplateSchema | null | undefined;
}): ProposalTemplateSchema | null {
  if (isProposalTemplate(proposal.proposalTemplate)) {
    return proposal.proposalTemplate;
  }

  return instanceTemplate ?? null;
}

function isProposalTemplate(value: unknown): value is ProposalTemplateSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
