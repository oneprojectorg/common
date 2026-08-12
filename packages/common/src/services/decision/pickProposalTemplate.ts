import type { ProposalTemplateSchema } from './types';

/**
 * Where a process's proposal template lives, in precedence order.
 *
 * A template is written to `instanceData.proposalTemplate` when a proposal form
 * is configured per-instance, and to `decisionProcesses.processSchema` as the
 * process-level default. Legacy instances only ever carry the latter — the
 * legacy encoder drops `instanceData.proposalTemplate` on the wire — so a
 * caller reading either one alone silently falls back to the default currency
 * for half the routes.
 *
 * The single definition of that order, shared by the server's
 * `resolveProposalTemplate` (which fetches the process row) and clients that
 * already hold both. Two hand-written copies would let the results banner label
 * a total with a different currency than the cards summed into it, and no type
 * would catch it: both fields are optional everywhere they appear.
 */
export function pickProposalTemplate(
  instanceProposalTemplate: unknown,
  processProposalTemplate: unknown,
): ProposalTemplateSchema | null {
  return (
    ((instanceProposalTemplate ?? processProposalTemplate) as
      | ProposalTemplateSchema
      | undefined) ?? null
  );
}
