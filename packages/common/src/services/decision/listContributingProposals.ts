import { and, db, eq, inArray } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
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
import { getMergedSourceProposalIds } from './proposalSupersession';
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

  // The assert rejects the whole `Promise.all`, so an unauthorized caller never
  // receives the rows read alongside it. Profile-level grants only — no org
  // fallback, matching `mergeProposals`. `ADMIN` isn't listed alongside `READ`
  // because the seeded decisions Admin role already carries `read`.
  const [decisionRoles, instance, contributingIds] = await Promise.all([
    assertProfileAccess({
      user,
      profileId: proposal.instance.profileId,
      permissions: { decisions: permission.READ },
    }),
    // Shares `getInstance`'s cached row: on a proposal page the decision has
    // almost certainly been read already, so this is a hit. A miss costs the
    // wider snapshot, which is the price of not forking the cache key.
    getCachedInstance(proposal.processInstanceId),
    getMergedSourceProposalIds({ targetProposalId: proposalId }),
  ]);

  const readContext = getProposalReadContext({ user, decisionRoles });

  const [pinnedIsReadable, rows, proposalTemplate] = await Promise.all([
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
    contributingIds.length === 0
      ? []
      : db.query.proposals.findMany({
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
    instance
      ? resolveProposalTemplate(
          instance.instanceData as Record<string, unknown> | null,
          instance.processId,
        )
      : null,
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

  if (contributingIds.length === 0) {
    return { queriedProposal, proposals: [] };
  }

  // `getProposalAccessContext` resolved it through this instance, so a miss means the
  // row was deleted between the two reads.
  if (!instance) {
    throw new NotFoundError('Decision instance', proposal.processInstanceId);
  }

  const [documentContentMap, flaggedIds] = await Promise.all([
    getProposalDocumentsContent(
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
    ),
    // Only its authors or an admin get this far, so the card can mark it.
    getActivelyFlaggedItemIds(
      'proposal',
      rows.map((row) => row.id),
    ),
  ]);

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
          isFlagged: flaggedIds.has(row.id),
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
