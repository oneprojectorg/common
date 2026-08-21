import { type SQL, and, db, eq, inArray, isNull, ne } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  Visibility,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';
import { getLinkedProposal } from './getLinkedProposal';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { isAnonymousAuthor, proposalAuthorRelation } from './proposalAuthor';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { proposalProfileColumns } from './proposalProfileColumns';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { ListContributingProposalsInput } from './schemas/contributingProposals';

/**
 * Same visibility floor `getProposal` applies, so this never surfaces a
 * proposal the caller couldn't open: no drafts, hidden, actively flagged, or
 * moderation-detached rows. Applied to both the pinned proposal and every
 * contributing one.
 */
const needsNoAccessException = (t: typeof proposals): SQL =>
  and(
    isNull(t.deletedAt),
    isNull(t.moderationDetachedAt),
    ne(t.status, ProposalStatus.DRAFT),
    eq(t.visibility, Visibility.VISIBLE),
    noActiveModerationFlag('proposal', t.id),
  )!;

/**
 * The proposals merged into `proposalId`, as "Contributing ideas" cards on the
 * surviving proposal's page.
 *
 * Rows carry the same shape every other card surface reads, assembled the same
 * way — `proposalAuthorRelation` + `isAnonymousAuthor` for the submitter, and
 * `buildProposalListPreview` for the title override and body excerpt. The card
 * then goes through the app's shared mapping, so the anonymity and
 * profile-linking rules can't drift on this one surface.
 *
 * Separate from `listProposalRelationships`, which answers the same question
 * about the edges but stays lean because the proposal header's "Merged into …"
 * notice reads it on every superseded proposal's page — this one resolves the
 * collaboration document, so it only runs where the cards actually render.
 *
 * Gated on `decisions: READ` rather than admin: merged-away proposals are
 * hidden from listings, but a contributing idea is meant to be visible to
 * everyone who can read the decision. Unpaginated — the fan-in is however many
 * proposals an admin merged together.
 */
export async function listContributingProposals({
  proposalId,
  user,
}: ListContributingProposalsInput & {
  user: User | undefined;
}) {
  const proposal = await getLinkedProposal(proposalId);

  // `Promise.all` rejects with the assert's error the moment it throws, so an
  // unauthorized caller never receives rows from the parallel reads.
  const [, pinnedIsReadable, instance, edges] = await Promise.all([
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
        and(eq(proposals.id, proposalId), needsNoAccessException(proposals)),
      )
      .limit(1),
    db.query.processInstances.findFirst({
      where: { id: proposal.processInstanceId },
      columns: { instanceData: true, processId: true },
    }),
    db
      .select({ sourceProposalId: proposalRelationships.sourceProposalId })
      .from(proposalRelationships)
      .where(
        and(
          eq(proposalRelationships.targetProposalId, proposalId),
          eq(
            proposalRelationships.relationshipType,
            ProposalRelationshipType.MERGED,
          ),
          isNull(proposalRelationships.deletedAt),
        ),
      )
      .orderBy(proposalRelationships.createdAt, proposalRelationships.id),
  ]);

  // `NotFoundError`, never `Unauthorized`, so a restricted proposal's existence
  // never leaks — the same choice `getProposal` makes.
  if (pinnedIsReadable.length === 0) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const queriedProposal = {
    id: proposal.proposalId,
    processInstanceId: proposal.processInstanceId,
  };

  const contributingIds = edges.map((edge) => edge.sourceProposalId);
  if (contributingIds.length === 0) {
    return { queriedProposal, proposals: [] };
  }

  // `getLinkedProposal` already resolved this proposal through its instance, so
  // a miss here means the row was deleted between the two reads.
  if (!instance) {
    throw new NotFoundError('Decision instance', proposal.processInstanceId);
  }

  const [rows, proposalTemplate] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            inArray(table.id, contributingIds),
            needsNoAccessException(table),
          )!,
      },
      with: {
        submittedBy: proposalAuthorRelation,
        profile: { columns: proposalProfileColumns },
      },
    }),
    resolveProposalTemplate(
      instance.instanceData as Record<string, unknown> | null,
      instance.processId,
    ),
  ]);

  const documentContentMap = await getProposalDocumentsContent(
    rows.map((row) => {
      const parsed = parseProposalData(row.proposalData);
      return {
        id: row.id,
        proposalData: row.proposalData,
        proposalTemplate,
        collaborationDocVersionId:
          row.status === ProposalStatus.DRAFT
            ? undefined
            : parsed.collaborationDocVersionId,
      };
    }),
    // A single unavailable document must not empty the whole section.
    { onFetchError: 'omit' },
  );

  const byId = new Map(
    rows.map((row) => {
      const rawSubmittedBy = Array.isArray(row.submittedBy)
        ? row.submittedBy[0]
        : row.submittedBy;
      const submittedBy = rawSubmittedBy
        ? (() => {
            const { profileUsers, ...author } = rawSubmittedBy;
            return { ...author, isAnonymous: isAnonymousAuthor(profileUsers) };
          })()
        : rawSubmittedBy;
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;

      const parsedProposalData = parseProposalData(row.proposalData);
      const { previewText, systemFieldOverrides } = buildProposalListPreview({
        documentContent: documentContentMap.get(row.id),
        proposalTemplate,
        existingBudget: parsedProposalData.budget,
      });

      return [
        row.id,
        {
          id: row.id,
          processInstanceId: row.processInstanceId,
          proposalData: { ...parsedProposalData, ...systemFieldOverrides },
          status: row.status,
          visibility: row.visibility,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          profileId: row.profileId,
          submittedBy,
          profile,
          previewText: previewText ?? undefined,
          proposalTemplate,
        },
      ];
    }),
  );

  return {
    queriedProposal,
    // Merge order, which lives on the edge rather than on `proposals`, so the
    // ordering is reapplied here. Safe to do in JS: the set is unpaginated and
    // already fully in memory.
    proposals: contributingIds
      .map((id) => byId.get(id))
      .filter((row) => row !== undefined),
  };
}
