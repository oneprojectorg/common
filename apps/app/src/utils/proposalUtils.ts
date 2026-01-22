import { formatCurrency, formatDate } from './formatting';

// Re-export schema and utilities from @op/common for backward compatibility
export {
  type ProposalData,
  parseProposalData,
  proposalDataSchema,
} from '@op/common';

// Re-export formatting utilities for backward compatibility
export { formatCurrency, formatDate };

/**
 * Extract unique submitters from proposals for display components like FacePile
 */
export function getUniqueSubmitters<
  T extends { submittedBy?: { id: string } | null },
>(proposals: T[]): Array<NonNullable<T['submittedBy']>> {
  return proposals.reduce(
    (acc, proposal) => {
      if (
        proposal.submittedBy &&
        !acc.some((s) => s.id === proposal.submittedBy?.id)
      ) {
        acc.push(proposal.submittedBy);
      }
      return acc;
    },
    [] as Array<NonNullable<T['submittedBy']>>,
  );
}

/**
 * Generate a collaboration document ID for a proposal.
 * Format: `proposal-{instanceId}-{proposalId}`
 */
export function generateProposalCollabDocId(
  instanceId: string,
  proposalId?: string,
): string {
  const id = proposalId || crypto.randomUUID();
  return `proposal-${instanceId}-${id}`;
}
