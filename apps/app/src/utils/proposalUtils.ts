/**
 * Extract unique submitters from proposals for display components like FacePile
 */
export function getUniqueSubmitters<
  T extends { submittedBy?: { id: string; slug?: string | null } | null },
>(proposals: T[]): Array<NonNullable<T['submittedBy']> & { slug: string }> {
  return proposals.reduce(
    (acc, proposal) => {
      const submitter = proposal.submittedBy;

      if (
        hasSubmitterSlug(submitter) &&
        !acc.some((s) => s.id === submitter.id)
      ) {
        acc.push(submitter);
      }
      return acc;
    },
    [] as Array<NonNullable<T['submittedBy']> & { slug: string }>,
  );
}

function hasSubmitterSlug<T extends { slug?: string | null }>(
  submitter: T | null | undefined,
): submitter is T & { slug: string } {
  return typeof submitter?.slug === 'string' && submitter.slug.length > 0;
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
