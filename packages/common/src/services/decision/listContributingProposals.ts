import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getCachedInstance } from './getCachedInstance';
import { getProposalAccessContext } from './getProposalAccessContext';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import {
  isAnonymousAuthor,
  proposalAuthorRelation,
  proposalProfileColumns,
} from './proposalAuthor';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import {
  getProposalReadContext,
  isProposalReadable,
} from './proposalVisibility';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { ListContributingProposalsInput } from './schemas/contributingProposals';

/**
 * The proposals merged into `proposalId`, as "Contributing ideas" cards.
 *
 * Separate from `listProposalRelationships`, which reads the same edges: that
 * one backs the "Merged into …" notice on every superseded proposal's page and
 * would then pay for the collaboration-document fetch only these cards need.
 */
export async function listContributingProposals({
  proposalId,
  user,
}: ListContributingProposalsInput & {
  user: User | undefined;
}) {
  const proposal = await getProposalAccessContext(proposalId);

  // Profile-level grants only — no org fallback, matching `mergeProposals`.
  // `ADMIN` isn't listed alongside `READ` because the seeded decisions Admin
  // role already carries `read`, so it would never admit anyone extra. Awaited
  // before the reads below, which need the roles it resolves.
  const decisionRoles = await assertProfileAccess({
    user,
    profileId: proposal.instance.profileId,
    permissions: { decisions: permission.READ },
  });

  const readContext = getProposalReadContext({ user, decisionRoles });

  const [pinnedIsReadable, instance, edges] = await Promise.all([
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.id, proposalId),
          isProposalReadable(proposals, readContext),
        ),
      )
      .limit(1),
    // Shares `getInstance`'s cached row: on a proposal page the decision has
    // almost certainly been read already, so this is a hit. A miss costs the
    // wider snapshot, which is the price of not forking the cache key.
    getCachedInstance(proposal.processInstanceId),
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
  // doesn't leak.
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

  // `getProposalAccessContext` resolved it through this instance, so a miss means the
  // row was deleted between the two reads.
  if (!instance) {
    throw new NotFoundError('Decision instance', proposal.processInstanceId);
  }

  const [rows, proposalTemplate] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            inArray(table.id, contributingIds),
            isProposalReadable(table, readContext),
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
    // Merge order lives on the edge, not on `proposals`. Reapplied in JS
    // because the set is unpaginated and already in memory.
    proposals: contributingIds
      .map((id) => byId.get(id))
      .filter((row) => row !== undefined),
  };
}
