import { and, db, sql } from '@op/db/client';
import {
  ProposalStatus,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { decodeCursor, encodeCursor, getCursorCondition } from '../../utils';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { getSelectedProposalIds } from './getSelectedProposalIds';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { resolveProposalListScope } from './resolveProposalListScope';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ListProposalsInput {
  processInstanceId: string;
  submittedByProfileId?: string;
  status?: ProposalStatus;
  search?: string;
  categoryId?: string;
  /** Scope results to a specific phase. Defaults to the current phase when omitted. */
  phaseId?: string;
  /**
   * Restrict results to proposals voted on by this profile. Bypasses phase
   * resolution so a ballot remains accessible after the process advances past
   * the voting phase.
   */
  votedByProfileId?: string;
  /**
   * Exclude proposals the current user is assigned to review in the viewed
   * phase (reviewer's "Other proposals" tab). Resolved server-side from the
   * caller's profile — never a client-supplied ID list.
   */
  excludeAssignedForReview?: boolean;
  /**
   * Internal override: skip phase resolution and use this exact set of IDs.
   * Not exposed on the tRPC schema — public callers should use phaseId or
   * votedByProfileId.
   */
  proposalIds?: string[];
  phase?: 'results';
  limit?: number;
  // Keyset pagination cursor from a previous page's `next` (see `getCursorCondition`).
  cursor?: string | null;
  orderBy?: 'createdAt' | 'updatedAt' | 'status' | 'votes';
  dir?: 'asc' | 'desc';
  skipAccessCheck?: boolean; // For trusted contexts like background jobs
  /**
   * When true, each returned proposal carries a `voteCount` aggregated from
   * vote submissions on `processInstanceId`. Pair with `orderBy: 'votes'` to
   * have the database drive the sort (descending count, createdAt tiebreak).
   * When used with `votedByProfileId`, counts are only returned after results
   * are formally published (gate prevents live-tally exposure during voting).
   */
  includeVoteCounts?: boolean;
  /**
   * Internal override: also return the full `documentContent` fragments per
   * row. Not exposed on the tRPC schema — list reads ship the precomputed
   * `previewText` instead; only trusted full-content consumers (e.g. the
   * proposals export) should set this.
   */
  includeDocumentContent?: boolean;
}

/**
 * Column picks for the `submittedBy`/`profile` relations on list rows. Covers
 * the fields the widest consumer needs — the legacy results encoder
 * (`baseProfileEncoder`, via `getInstanceResults`) requires the full profile
 * shape, while the non-legacy `proposalSchema` encoder narrows further on the
 * wire. Keeps only the generated `search` tsvector and other never-encoded
 * columns out of the lateral joins.
 */
export const proposalProfileColumns = {
  id: true,
  type: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  bio: true,
  mission: true,
  email: true,
  website: true,
} satisfies Record<string, true>;

export const listProposals = async ({
  input,
  user,
}: {
  input: ListProposalsInput;
  user: User | undefined;
}) => {
  const { processInstanceId, skipAccessCheck = false } = input;

  // Access/phase/visibility/moderation scope is resolved by the shared helper
  // so this paginated read and `listProposalLocations` filter identically.
  const {
    instance,
    currentProfileId,
    canManageProposals,
    profileRoles,
    isEmpty,
    buildWhereClause,
  } = await resolveProposalListScope({ input, user });

  // Template resolution depends only on the instance row — start it now so
  // its (occasional) fallback DB read overlaps the main query instead of
  // adding a serial barrier afterwards.
  const proposalTemplatePromise = resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );
  // Backstop: if this function throws or early-returns before the template is
  // awaited (auth failure, bad cursor, empty phase window), a rejection here
  // must not surface as an unhandled promise rejection. The later `await`
  // still rethrows.
  proposalTemplatePromise.catch(() => {});

  // The empty short-circuit is split around the cursor decode to preserve
  // pre-existing error semantics: trusted contexts always exited before
  // decoding, while authenticated callers decoded first — so a malformed
  // cursor still throws for them even when the result set is empty.
  const emptyResult = {
    proposals: [],
    total: 0,
    hasMore: false,
    canManageProposals,
    next: null,
  };

  if (isEmpty && skipAccessCheck) {
    return emptyResult;
  }

  const { limit = 20, orderBy = 'createdAt', dir = 'desc' } = input;
  const decodedCursor = input.cursor
    ? decodeCursor<{ value: string | Date; id: string }>(input.cursor)
    : undefined;

  if (isEmpty) {
    return emptyResult;
  }

  const { includeVoteCounts = false } = input;

  // Voter-filtered queries (votedByProfileId) always return a voteCount field,
  // but the count is gated on a successful results record so live tallies are
  // never exposed during voting: null until results are published, after which
  // 0 always means zero recorded votes.
  let resultsPublished = false;
  if (input.votedByProfileId) {
    const publishedResult = await db.query.decisionProcessResults.findFirst({
      where: {
        processInstanceId,
        success: true,
      },
      columns: { id: true },
    });
    resultsPublished = !!publishedResult;
  }

  const effectiveIncludeVoteCounts = input.votedByProfileId
    ? resultsPublished
    : includeVoteCounts;

  // Vote-count correlated subquery factory. Called by both the `extras`
  // callback and the `orderBy` callback so each receives the v2-aliased
  // `table` and embeds the correct outer-column reference.
  //
  // Scoping the join to `processInstanceId` ensures cross-instance ballots
  // can't inflate counts.
  const voteCountExpr = (t: typeof proposals) =>
    sql<number>`(
      SELECT COUNT(*)::int FROM ${decisionsVoteSubmissions}
      INNER JOIN ${decisionsVoteProposals}
        ON ${decisionsVoteProposals.voteSubmissionId} = ${decisionsVoteSubmissions.id}
      WHERE ${decisionsVoteProposals.proposalId} = ${t.id}
      AND ${decisionsVoteSubmissions.processInstanceId} = ${input.processInstanceId}
    )`;

  const [rawProposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      // Cursor lives only on the data query so `total` stays the full count.
      // `votes` sorts by a computed aggregate, so it can't keyset (never paginated).
      where: {
        RAW: (table) =>
          and(
            buildWhereClause(table),
            orderBy === 'votes'
              ? undefined
              : getCursorCondition({
                  column: table[orderBy] ?? table.createdAt,
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
      // Fetch one extra to detect whether a next page exists.
      limit: limit + 1,
      ...(effectiveIncludeVoteCounts && {
        extras: {
          voteCount: (table, { sql: sqlOp }) =>
            sqlOp<number>`${voteCountExpr(table)}`.as('vote_count'),
        },
      }),
      orderBy: (table, { asc: ascOp, desc: descOp }) => {
        // `id` tie-break: without it, rows sharing the primary sort key
        // return in undefined order and flipping `dir` has no visible effect.
        const directional = dir === 'asc' ? ascOp : descOp;
        if (orderBy === 'votes') {
          return [
            descOp(voteCountExpr(table)),
            descOp(table.createdAt),
            descOp(table.id),
          ];
        }
        return [
          directional(table[orderBy] ?? table.createdAt),
          directional(table.id),
        ];
      },
    }),
    // Count uses the same builder against the schema table, producing
    // unaliased SQL that matches the FROM clause here.
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(buildWhereClause(proposals)),
  ]);

  const count = countResult[0]?.count || 0;

  const hasMore = rawProposalList.length > limit;
  const proposalList = hasMore
    ? rawProposalList.slice(0, limit)
    : rawProposalList;

  type ProposalListItem = (typeof proposalList)[number];

  // Resolved from instanceData (falling back to processSchema) — the promise
  // was started right after the scope resolved, so this await is usually free.
  const proposalTemplate = await proposalTemplatePromise;

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap, selectedIds, flaggedIds] =
    await Promise.all([
      getProposalRelationshipData({ profileIds, currentProfileId }),
      getProposalDocumentsContent(
        proposalList.map((proposal) => {
          const parsed = parseProposalData(proposal.proposalData);
          return {
            id: proposal.id,
            proposalData: proposal.proposalData,
            proposalTemplate,
            collaborationDocVersionId:
              proposal.status === ProposalStatus.DRAFT
                ? undefined
                : parsed.collaborationDocVersionId,
          };
        }),
        // A single unavailable document must not break the whole list.
        { onFetchError: 'omit' },
      ),
      getSelectedProposalIds(processInstanceId),
      // Flagged items reach this point only for their creator or an admin —
      // decorate them so the UI can render the "Flagged" indicator.
      getActivelyFlaggedItemIds(
        'proposal',
        proposalList.map((proposal) => proposal.id),
      ),
    ]);

  const hasAdminPermission = checkPermission(
    { profile: permission.ADMIN },
    profileRoles,
  );

  const proposalsWithCounts = proposalList.map((proposal: ProposalListItem) => {
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

    // In results phase, proposals are never editable.
    const isOwner = proposal.submittedByProfileId === currentProfileId;
    const isEditable =
      input.phase === 'results' ? false : isOwner || hasAdminPermission;

    // List rows ship a precomputed plain-text preview plus fragment-resolved
    // system fields instead of the full document fragments; the fragments
    // themselves only ride along for trusted full-content consumers.
    const documentContent = documentContentMap.get(proposal.id);
    const { previewText, systemFieldOverrides } = buildProposalListPreview({
      documentContent,
      proposalTemplate,
    });

    // `voteCount` only rides along as an extra when the count was requested.
    const voteCount = effectiveIncludeVoteCounts
      ? Number('voteCount' in proposal ? (proposal.voteCount ?? 0) : 0)
      : null;

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
      isEditable,
      isSelected: selectedIds.has(proposal.id),
      isFlagged: flaggedIds.has(proposal.id),
      previewText: previewText ?? undefined,
      documentContent: input.includeDocumentContent
        ? documentContent
        : undefined,
      proposalTemplate,
      // Ballot reads always carry the field: `null` until results are
      // published (so no live tally leaks), a real count afterwards — where
      // `0` unambiguously means zero recorded votes.
      ...(input.votedByProfileId
        ? { voteCount }
        : effectiveIncludeVoteCounts && { voteCount }),
    };
  });

  // Keyset cursor off the last row's sort value + id tiebreak (votes can't
  // keyset, so it stays a single page).
  const lastItem = proposalsWithCounts[proposalsWithCounts.length - 1];
  const cursorValue =
    lastItem && orderBy !== 'votes' ? lastItem[orderBy] : null;
  // `!= null` (not a truthy check) so a falsy-but-valid sort value — e.g. a
  // rubric score of 0 — still produces a cursor instead of silently ending.
  const next =
    hasMore && lastItem && cursorValue != null
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: cursorValue,
          id: lastItem.id,
        })
      : null;

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore,
    canManageProposals,
    next,
  };
};
