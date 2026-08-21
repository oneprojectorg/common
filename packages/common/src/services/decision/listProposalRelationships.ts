import { type SQL, and, db, eq, inArray, isNull, ne } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  objectsInStorage,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';
import { getLinkedProposal } from './getLinkedProposal';
import { parseProposalData } from './proposalDataSchema';
import type {
  ListProposalRelationshipsInput,
  ProposalRelationshipAuthor,
  ProposalRelationshipList,
} from './schemas/proposalRelationships';

/**
 * Read access to a decision doesn't imply read access to every proposal in it:
 * `getProposal` restricts drafts, hidden and flagged proposals, and treats
 * moderation-detached ones as missing. Applied to *both* ends here — the pinned
 * proposal and the far one — so a link neither surfaces a proposal the caller
 * couldn't open nor reveals that a restricted one has a relationship at all. The
 * profile name exposed alongside is the proposal's title.
 */
const needsNoAccessException = (t: typeof proposals): SQL =>
  and(
    isNull(t.deletedAt),
    isNull(t.moderationDetachedAt),
    ne(t.status, ProposalStatus.DRAFT),
    eq(t.visibility, Visibility.VISIBLE),
    noActiveModerationFlag('proposal', t.id),
  )!;

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

  const proposal = await getLinkedProposal(pinnedProposalId);

  const pinnedColumn = sourceProposalId
    ? proposalRelationships.sourceProposalId
    : proposalRelationships.targetProposalId;
  const farColumn = sourceProposalId
    ? proposalRelationships.targetProposalId
    : proposalRelationships.sourceProposalId;

  // `Promise.all` rejects with the assert's error the moment it throws, so an
  // unauthorized caller never receives rows from the parallel read.
  const [, pinnedIsReadable, rows] = await Promise.all([
    // The same grant `listProposals` requires to see the decision's proposals.
    assertInstanceProfileAccess({
      user,
      instance: proposal.instance,
      profilePermissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
      orgFallbackPermissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
    }),
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.id, pinnedProposalId),
          needsNoAccessException(proposals),
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
        proposalData: proposals.proposalData,
        submittedByProfileId: proposals.submittedByProfileId,
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
          needsNoAccessException(proposals),
        ),
      )
      .orderBy(proposalRelationships.createdAt, proposalRelationships.id),
  ]);

  // `NotFoundError`, never `Unauthorized`, so a restricted proposal's existence
  // never leaks — the same choice `getProposal` makes.
  if (pinnedIsReadable.length === 0) {
    throw new NotFoundError('Proposal', pinnedProposalId);
  }

  const submitters = await getRelationshipSubmitters(rows);

  return {
    queriedProposal: {
      id: proposal.proposalId,
      processInstanceId: proposal.processInstanceId,
    },
    relationships: rows.map((row) => {
      const { budget, category } = parseProposalData(row.proposalData);

      return {
        id: row.id,
        relationshipType: row.relationshipType,
        createdAt: row.createdAt,
        proposal: {
          id: row.proposalId,
          status: row.proposalStatus,
          profile: row.profile,
          // `null` rather than the parser's `undefined`, so "no budget" survives
          // serialization as an explicit absence.
          budget: budget ?? null,
          categories: category,
          submittedBy: row.submittedByProfileId
            ? (submitters.get(row.submittedByProfileId) ?? null)
            : null,
        },
      };
    }),
  };
}

/**
 * Submitter name + avatar for a page of relationship rows, keyed by profile id.
 *
 * A second query rather than a join: the edge query already joins `profiles`
 * for the far proposal's own profile, and Drizzle's join-nullability mapping
 * collapses the whole row type to `never` when one base table is joined twice
 * (aliased or not). The fan-in is one admin's merges, so this reads a handful
 * of rows.
 */
async function getRelationshipSubmitters(
  rows: Array<{ submittedByProfileId: string | null }>,
): Promise<Map<string, ProposalRelationshipAuthor>> {
  const submitterIds = [
    ...new Set(
      rows
        .map((row) => row.submittedByProfileId)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (submitterIds.length === 0) {
    return new Map();
  }

  const submitterRows = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      // Left join: a submitter needn't have an avatar.
      avatarImageName: objectsInStorage.name,
    })
    .from(profiles)
    .leftJoin(objectsInStorage, eq(objectsInStorage.id, profiles.avatarImageId))
    .where(inArray(profiles.id, submitterIds));

  return new Map(
    submitterRows.map((row) => [
      row.id,
      { name: row.name, avatarImageName: row.avatarImageName },
    ]),
  );
}
