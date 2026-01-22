import { z } from 'zod';

import { formatCurrency, formatDate } from './formatting';

// Define the expected structure of proposalData with better type safety
export const proposalDataSchema = z
  .looseObject({
    title: z.string().optional(),
    description: z.string().optional(), // Schema expects 'description'
    content: z.string().optional(), // Keep for backward compatibility
    category: z.string().optional(),
    budget: z.number().optional(),
    attachmentIds: z.array(z.string()).optional().prefault([]),
  }) // Allow additional fields
  .transform((data) => {
    // Handle backward compatibility: if content exists but not description, use content as description
    if (data.content && !data.description) {
      data.description = data.content;
    }
    return data;
  });

export type ProposalData = z.infer<typeof proposalDataSchema>;

/**
 * Safely parse proposal data with fallback to unknown structure
 */
export function parseProposalData(proposalData: unknown): ProposalData {
  const result = proposalDataSchema.safeParse(proposalData);
  return result.success ? result.data : (proposalData as any) || {};
}

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
