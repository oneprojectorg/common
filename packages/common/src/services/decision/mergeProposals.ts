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
import { getLinkedProposal } from './getLinkedProposal';
import { findLiveMergedEdge } from './proposalSupersession';
import type { MergeProposalsInput } from './schemas/proposalRelationships';

export type MergeProposalsResult = {
  processInstanceId: string;
  sourceProposalId: string;
  targetProposalId: string;
};

/**
 * Links one proposal into another as `merged`, for admins of the parent
 * decision. No content moves and no status changes — recording the edge is the
 * entire effect, and it's what every read filters on via `notSuperseded`.
 *
 * Chains are allowed — a proposal with others merged into it can be merged
 * onward. The target must still be live, which both keeps the merge visible and
 * makes a cycle unrepresentable: a proposal that has merged away can never
 * become a target.
 *
 * `note` is stored on the edge so it soft-deletes with the merge. Nothing mails
 * it yet — there is no merge notification.
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

  const [source, target] = await Promise.all([
    getLinkedProposal(sourceProposalId),
    getLinkedProposal(targetProposalId),
  ]);

  // The composite foreign keys make a cross-decision edge unrepresentable; this
  // check is here to fail with a useful message rather than a driver error.
  if (source.processInstanceId !== target.processInstanceId) {
    throw new ValidationError(
      'Proposals can only be merged within the same decision',
    );
  }

  // `Promise.all` rejects with the assert's error the moment it throws, so an
  // unauthorized caller learns nothing from the parallel lookup.
  const [, targetAlreadyMerged] = await Promise.all([
    assertProfileAccess({
      user,
      profileId: source.instance.profileId,
      permissions: { decisions: permission.ADMIN },
    }),
    findLiveMergedEdge({
      processInstanceId: source.processInstanceId,
      sourceProposalId: targetProposalId,
    }),
  ]);

  if (source.status === ProposalStatus.DRAFT) {
    throw new ValidationError('A draft proposal cannot be merged');
  }

  if (targetAlreadyMerged) {
    throw new ConflictError(
      'Cannot merge into a proposal that has itself been merged',
    );
  }

  // No transaction needed: the partial unique index enforces "superseded at most
  // once", and `onConflictDoNothing` turns a concurrent merge into an empty
  // result rather than a driver error.
  const [inserted] = await db
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

  return {
    processInstanceId: source.processInstanceId,
    sourceProposalId: source.proposalId,
    targetProposalId: target.proposalId,
  };
}
