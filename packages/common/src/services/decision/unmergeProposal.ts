import { and, db, eq, isNull } from '@op/db/client';
import { proposalRelationships } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { ConflictError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import { findLiveMergedEdge } from './proposalSupersession';
import type { UnmergeProposalInput } from './schemas/proposalRelationships';

export type UnmergeProposalResult = {
  processInstanceId: string;
  sourceProposalId: string;
  targetProposalId: string;
};

/**
 * Undoes {@link mergeProposals}, for admins of the parent decision. The proposal
 * row is untouched because merging never changed it. The edge is soft-deleted so
 * the pair can be re-linked and the merge stays on record.
 */
export async function unmergeProposal({
  sourceProposalId,
  user,
}: UnmergeProposalInput & { user: User }): Promise<UnmergeProposalResult> {
  const source = await getProposalAccessContext(sourceProposalId);

  // `Promise.all` rejects with the assert's error the moment it throws, so an
  // unauthorized caller learns nothing from the parallel lookup.
  const [, relationship] = await Promise.all([
    assertProfileAccess({
      user,
      profileId: source.instance.profileId,
      permissions: { decisions: permission.ADMIN },
    }),
    findLiveMergedEdge({
      processInstanceId: source.processInstanceId,
      sourceProposalId,
    }),
  ]);

  if (!relationship) {
    throw new NotFoundError('Merged proposal relationship', sourceProposalId);
  }

  // Gating on the row still being live is what makes two concurrent unmerges
  // resolve to one success and one conflict.
  const removed = await db
    .update(proposalRelationships)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(proposalRelationships.id, relationship.id),
        isNull(proposalRelationships.deletedAt),
      ),
    )
    .returning({ id: proposalRelationships.id });

  if (removed.length === 0) {
    throw new ConflictError(
      'This proposal was already unmerged; refresh and retry',
    );
  }

  return {
    processInstanceId: source.processInstanceId,
    sourceProposalId: source.proposalId,
    targetProposalId: relationship.targetProposalId,
  };
}
