import { db } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposalRelationships,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { ConflictError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { deletePendingReviewAssignments } from './deletePendingReviewAssignments';
import { getProposalAccessContext } from './getProposalAccessContext';
import { findLiveMergedEdge } from './proposalSupersession';
import type { MergeProposalsInput } from './schemas/proposalRelationships';

export type MergeProposalsResult = {
  processInstanceId: string;
  sourceProposalId: string;
  targetProposalId: string;
  /** So the caller can announce this specific merge. */
  relationshipId: string;
  removedReviewAssignmentCount: number;
};

/**
 * Links one proposal into another as `merged`, for admins of the parent
 * decision. No content moves and no status changes; every read filters on the
 * edge via `notSuperseded`.
 *
 * Chains are allowed — a proposal with others merged into it can be merged
 * onward. The target must still be live, which both keeps the merge visible and
 * makes a cycle unrepresentable: a proposal that has merged away can never
 * become a target.
 *
 * `note` lives on the edge so it soft-deletes with the merge; the notification
 * quotes it back to the merged-away authors.
 */
export async function mergeProposals({
  sourceProposalId,
  targetProposalId,
  note,
  user,
}: MergeProposalsInput & { user: User }): Promise<MergeProposalsResult> {
  if (sourceProposalId === targetProposalId) {
    throw new ValidationError('A proposal cannot be merged into itself');
  }

  // The source is read first because its decision is what admin is asserted
  // against; everything the target could reveal waits behind that assert.
  const source = await getProposalAccessContext(sourceProposalId);

  await assertProfileAccess({
    user,
    profileId: source.instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  const [target, targetAlreadyMerged] = await Promise.all([
    getProposalAccessContext(targetProposalId),
    findLiveMergedEdge({
      processInstanceId: source.processInstanceId,
      sourceProposalId: targetProposalId,
    }),
  ]);

  // The composite foreign keys make a cross-decision edge unrepresentable; this
  // check is here to fail with a useful message rather than a driver error.
  if (source.processInstanceId !== target.processInstanceId) {
    throw new ValidationError(
      'Proposals can only be merged within the same decision',
    );
  }

  if (source.status === ProposalStatus.DRAFT) {
    throw new ValidationError('A draft proposal cannot be merged');
  }

  if (targetAlreadyMerged) {
    throw new ConflictError(
      'Cannot merge into a proposal that has itself been merged',
    );
  }

  const { relationshipId, removedReviewAssignmentCount } = await db.transaction(
    async (tx) => {
      const [inserted] = await tx
        .insert(proposalRelationships)
        .values({
          processInstanceId: source.processInstanceId,
          sourceProposalId,
          targetProposalId,
          relationshipType: ProposalRelationshipType.MERGED,
          // The column distinguishes "no note" from "an empty note".
          note: note ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: proposalRelationships.id });

      if (!inserted) {
        throw new ConflictError('This proposal has already been merged');
      }

      const instance = await tx.query.processInstances.findFirst({
        where: { id: source.processInstanceId },
        columns: { currentStateId: true },
      });
      const removed = instance?.currentStateId
        ? await deletePendingReviewAssignments({
            db: tx,
            processInstanceId: source.processInstanceId,
            phaseId: instance.currentStateId,
            proposalIds: [sourceProposalId],
          })
        : [];

      return {
        relationshipId: inserted.id,
        removedReviewAssignmentCount: removed.length,
      };
    },
  );

  return {
    processInstanceId: source.processInstanceId,
    sourceProposalId: source.proposalId,
    targetProposalId: target.proposalId,
    relationshipId,
    removedReviewAssignmentCount,
  };
}
