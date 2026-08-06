import { and, db } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';

import { decodeCursor, encodeCursor, getCursorCondition } from '../../utils';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { getSelectedProposalIds } from './getSelectedProposalIds';
import { proposalProfileColumns } from './listProposals';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { resolveAllProposalsScope } from './resolveAllProposalsScope';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { AllProposalsFilter } from './schemas/proposal';

/**
 * Returns proposals on the instance for the "All proposals" tab on the
 * results page. Drafts, rejected, duplicate, and soft-deleted proposals
 * are excluded for everyone. Non-admin members additionally see only
 * visible proposals; decision admins also see hidden proposals so they
 * can audit and report on what was submitted to the process.
 */
export const listAllProposals = async ({
  input,
  user,
}: {
  input: AllProposalsFilter;
  user: User | undefined;
}) => {
  const limit = input.limit ?? 50;
  const orderBy = input.orderBy ?? 'createdAt';
  const dir = input.dir ?? 'desc';

  const decodedCursor = input.cursor
    ? decodeCursor<{ value: string | Date; id: string }>(input.cursor)
    : undefined;

  // Access/visibility/moderation scope is resolved by the shared helper so this
  // paginated read and `listAllProposalLocations` filter identically.
  const { instance, currentProfileId, buildWhereClause } =
    await resolveAllProposalsScope({ input, user });

  // Template resolution depends only on the instance row — start it now so its
  // (occasional) fallback DB read overlaps the main query instead of adding a
  // serial barrier afterwards.
  const proposalTemplatePromise = resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );
  // Backstop: if this function throws before the template is awaited (a
  // malformed cursor), a rejection here must not surface as an unhandled
  // promise rejection. The later `await` still rethrows.
  proposalTemplatePromise.catch(() => {});

  // Cursor lives only on the data query, so `total` stays the full match count.
  const [proposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            buildWhereClause(table),
            getCursorCondition({
              column: table[orderBy],
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: dir,
            }),
          )!,
      },
      with: {
        submittedBy: {
          columns: proposalProfileColumns,
          with: {
            avatarImage: true,
            profileUsers: {
              columns: {},
              with: { authUser: { columns: { isAnonymous: true } } },
            },
          },
        },
        profile: { columns: proposalProfileColumns },
      },
      limit: limit + 1, // Fetch one extra to check whether there's a next page.
      // `id` tie-break: without it, rows sharing the sort value are skipped at page boundaries.
      orderBy: (table, { asc, desc }) =>
        dir === 'asc'
          ? [asc(table[orderBy]), asc(table.id)]
          : [desc(table[orderBy]), desc(table.id)],
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(buildWhereClause(proposals)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const hasMore = proposalList.length > limit;
  const pageItems = hasMore ? proposalList.slice(0, limit) : proposalList;

  // Resolved from instanceData (falling back to processSchema) — the promise
  // was started right after the instance fetch, so this await is usually free.
  const proposalTemplate = await proposalTemplatePromise;

  const profileIds = pageItems
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap, selectedIds, flaggedIds] =
    await Promise.all([
      getProposalRelationshipData({ profileIds, currentProfileId }),
      getProposalDocumentsContent(
        pageItems.map((proposal) => ({
          id: proposal.id,
          proposalData: proposal.proposalData,
          proposalTemplate,
          // Everything here is submitted (drafts are excluded above), so the
          // pinned version keys the immutable collab-doc cache.
          collaborationDocVersionId: parseProposalData(proposal.proposalData)
            .collaborationDocVersionId,
        })),
        // A single unavailable document must not break the whole list.
        { onFetchError: 'omit' },
      ),
      getSelectedProposalIds(input.processInstanceId),
      // Flagged items reach this point only for their creator or an admin —
      // decorate them so the UI can render the "Flagged" indicator.
      getActivelyFlaggedItemIds(
        'proposal',
        pageItems.map((proposal) => proposal.id),
      ),
    ]);

  const items = pageItems.map((proposal) => {
    const rawSubmittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const submittedBy = rawSubmittedBy
      ? (() => {
          const { profileUsers, ...author } = rawSubmittedBy;
          return {
            ...author,
            isAnonymous: Boolean(
              profileUsers?.some(
                (pu: { authUser: { isAnonymous: boolean } | null }) =>
                  pu.authUser?.isAnonymous,
              ),
            ),
          };
        })()
      : rawSubmittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = relationshipData.get(proposal.profileId);

    // List rows ship a precomputed plain-text preview plus fragment-resolved
    // system fields instead of the full document fragments.
    const { previewText, systemFieldOverrides } = buildProposalListPreview({
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate,
    });

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: {
        ...parseProposalData(proposal.proposalData),
        ...systemFieldOverrides,
      },
      status: proposal.status,
      visibility: proposal.visibility,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      profileId: proposal.profileId,
      submittedBy,
      profile,
      likesCount: relationshipInfo?.likesCount || 0,
      followersCount: relationshipInfo?.followersCount || 0,
      isLikedByUser: relationshipInfo?.isLikedByUser || false,
      isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
      commentsCount: relationshipInfo?.commentsCount || 0,
      isSelected: selectedIds.has(proposal.id),
      isFlagged: flaggedIds.has(proposal.id),
      previewText: previewText ?? undefined,
      proposalTemplate,
    };
  });

  const lastItem = items[items.length - 1];
  const cursorValue = lastItem ? lastItem[orderBy] : null;
  // `!= null` (not a truthy check) so a falsy-but-valid sort value — e.g. a
  // rubric score of 0 — still produces a cursor instead of silently ending.
  const next =
    hasMore && lastItem && cursorValue != null
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: cursorValue,
          id: lastItem.id,
        })
      : null;

  return { items, total, next };
};
