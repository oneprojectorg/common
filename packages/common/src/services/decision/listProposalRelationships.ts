import { and, db, eq, isNull } from '@op/db/client';
import { profiles, proposalRelationships, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import {
  isProposalReadableBy,
  resolveProposalViewer,
} from './proposalVisibility';
import type {
  ListProposalRelationshipsInput,
  ProposalRelationshipList,
} from './schemas/proposalRelationships';

export type ListProposalRelationshipsResult = ProposalRelationshipList & {
  /** Not part of the wire shape; the router uses it to name the realtime channel. */
  queriedProposal: { id: string; processInstanceId: string };
};

/**
 * Live relationships on one end of a proposal: pin `targetProposalId` for what was
 * merged into it, `sourceProposalId` for what it was merged into. Each row carries
 * the proposal at the end the caller didn't pin.
 *
 * The one read that shows superseded proposals, so it's gated on `decisions: READ`
 * rather than admin. It exposes only id, status, and profile name/slug — opening
 * one still goes through `getProposal` and its full gate. Unpaginated: the fan-in
 * is however many proposals an admin merged together.
 */
export async function listProposalRelationships({
  sourceProposalId,
  targetProposalId,
  user,
}: ListProposalRelationshipsInput & {
  user: User | undefined;
}): Promise<ListProposalRelationshipsResult> {
  // Also narrows `pinnedProposalId` to a string for everything below.
  const pinnedProposalId = sourceProposalId ?? targetProposalId;
  if (!pinnedProposalId || (sourceProposalId && targetProposalId)) {
    throw new ValidationError(
      'Pass exactly one of sourceProposalId or targetProposalId',
    );
  }

  const proposal = await getProposalAccessContext(pinnedProposalId);

  const pinnedColumn = sourceProposalId
    ? proposalRelationships.sourceProposalId
    : proposalRelationships.targetProposalId;
  const farColumn = sourceProposalId
    ? proposalRelationships.targetProposalId
    : proposalRelationships.sourceProposalId;

  // Profile-level grants only, matching `listContributingProposals`. No org
  // fallback: only legacy processes relied on it and those are all complete,
  // so none of them can gain a merge. Awaited first: the roles it returns are
  // what decide whether this caller is an admin.
  const instanceProfileRoles = await assertProfileAccess({
    user,
    profileId: proposal.instance.profileId,
    permissions: { decisions: permission.READ },
  });
  const viewer = resolveProposalViewer({ user, instanceProfileRoles });

  const [pinnedIsReadable, rows] = await Promise.all([
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.id, pinnedProposalId),
          isProposalReadableBy({ table: proposals, viewer }),
        ),
      )
      .limit(1),
    db
      .select({
        id: proposalRelationships.id,
        relationshipType: proposalRelationships.relationshipType,
        createdAt: proposalRelationships.createdAt,
        proposalId: proposals.id,
        proposalStatus: proposals.status,
        profile: {
          id: profiles.id,
          name: profiles.name,
          slug: profiles.slug,
        },
      })
      .from(proposalRelationships)
      // Inner joins: the composite foreign keys guarantee the far end is a
      // proposal in this decision, and every proposal owns a profile.
      .innerJoin(proposals, eq(proposals.id, farColumn))
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .where(
        and(
          eq(pinnedColumn, pinnedProposalId),
          isNull(proposalRelationships.deletedAt),
          isProposalReadableBy({ table: proposals, viewer }),
        ),
      )
      .orderBy(proposalRelationships.createdAt, proposalRelationships.id),
  ]);

  // `NotFoundError`, never `Unauthorized`, so a restricted proposal's existence
  // never leaks — the same choice `getProposal` makes.
  if (pinnedIsReadable.length === 0) {
    throw new NotFoundError('Proposal', pinnedProposalId);
  }

  return {
    queriedProposal: {
      id: proposal.proposalId,
      processInstanceId: proposal.processInstanceId,
    },
    relationships: rows.map((row) => ({
      id: row.id,
      relationshipType: row.relationshipType,
      createdAt: row.createdAt,
      proposal: {
        id: row.proposalId,
        status: row.proposalStatus,
        profile: row.profile,
      },
    })),
  };
}
