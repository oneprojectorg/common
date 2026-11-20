import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

/** Whether the proposal is an entry: the target of a live `developed` edge. */
export async function isDevelopedProposal(
  proposalId: string,
): Promise<boolean> {
  const developedEdge = await db.query.proposalRelationships.findFirst({
    where: {
      targetProposalId: proposalId,
      relationshipType: ProposalRelationshipType.DEVELOPED,
      deletedAt: { isNull: true },
    },
    columns: { id: true },
  });

  return Boolean(developedEdge);
}
