import {
  SQL,
  and,
  db,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  profileUsers,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  resolveAccessUserIds,
} from '../access';
import {
  getActivelyFlaggedItemIds,
  noActiveModerationFlag,
} from '../moderation/moderationVisibility';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { getSelectedProposalIds } from './getSelectedProposalIds';
import { parseProposalData } from './proposalDataSchema';
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
  const { processInstanceId, status, categoryId } = input;
  const limit = input.limit ?? 50;
  const orderBy = input.orderBy ?? 'createdAt';
  const dir = input.dir ?? 'desc';

  const decodedCursor = input.cursor
    ? decodeCursor<{ value: string | Date; id: string }>(input.cursor)
    : undefined;

  // The caller's own grants unioned with public grants — used by the
  // moderation owner-exception subquery (proposal.profileId membership).
  const accessUserIds = resolveAccessUserIds(user);

  const [currentProfileId, instance] = await Promise.all([
    user ? getCurrentProfileId(user.id) : undefined,
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  const profileRoles = await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  const isAdmin = checkPermission(
    { decisions: permission.ADMIN },
    profileRoles,
  );

  // Ballots are private — a caller may only request their own.
  let votedProposalIds: string[] | undefined;
  if (input.votedByProfileId) {
    if (currentProfileId !== input.votedByProfileId) {
      throw new UnauthorizedError('You can only view your own ballot');
    }
    const votedRows = await db
      .select({ proposalId: decisionsVoteProposals.proposalId })
      .from(decisionsVoteSubmissions)
      .innerJoin(
        decisionsVoteProposals,
        eq(
          decisionsVoteSubmissions.id,
          decisionsVoteProposals.voteSubmissionId,
        ),
      )
      .where(
        and(
          eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
          eq(
            decisionsVoteSubmissions.submittedByProfileId,
            input.votedByProfileId,
          ),
        ),
      );
    votedProposalIds = votedRows.map((row) => row.proposalId);
  }

  // Shared by the data and count queries; param'd on the table ref so it works
  // for both the relational `RAW` alias and the plain schema table.
  const buildBaseConditions = (t: typeof proposals): SQL =>
    and(
      eq(t.processInstanceId, processInstanceId),
      status ? eq(t.status, status) : undefined,
      input.submittedByProfileId
        ? eq(t.submittedByProfileId, input.submittedByProfileId)
        : undefined,
      votedProposalIds
        ? votedProposalIds.length > 0
          ? inArray(t.id, votedProposalIds)
          : sql`false`
        : undefined,
      categoryId
        ? exists(
            db
              .select({ id: proposalCategories.proposalId })
              .from(proposalCategories)
              .where(
                and(
                  eq(proposalCategories.proposalId, t.id),
                  eq(proposalCategories.taxonomyTermId, categoryId),
                ),
              ),
          )
        : undefined,
      notInArray(t.status, [
        ProposalStatus.DRAFT,
        ProposalStatus.REJECTED,
        ProposalStatus.DUPLICATE,
      ]),
      isNull(t.deletedAt),
      isAdmin ? undefined : eq(t.visibility, Visibility.VISIBLE),
      // Items with an active moderation flag are hidden from everyone
      // except members of the proposal's own profile (the same audience
      // getProposal grants it to, so list and detail agree); admins skip
      // the filter.
      isAdmin
        ? undefined
        : or(
            noActiveModerationFlag('proposal', t.id),
            inArray(
              t.profileId,
              db
                .select({ profileId: profileUsers.profileId })
                .from(profileUsers)
                .where(inArray(profileUsers.authUserId, accessUserIds)),
            ),
          ),
    )!;

  // Cursor lives only on the data query, so `total` stays the full match count.
  const [proposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            buildBaseConditions(table),
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
          with: {
            avatarImage: true,
          },
        },
        profile: true,
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
      .where(buildBaseConditions(proposals)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const hasMore = proposalList.length > limit;
  const pageItems = hasMore ? proposalList.slice(0, limit) : proposalList;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

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
        })),
      ),
      getSelectedProposalIds(processInstanceId),
      // Flagged items reach this point only for their creator or an admin —
      // decorate them so the UI can render the "Flagged" indicator.
      getActivelyFlaggedItemIds(
        'proposal',
        pageItems.map((proposal) => proposal.id),
      ),
    ]);

  const items = pageItems.map((proposal) => {
    const submittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = relationshipData.get(proposal.profileId);

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: parseProposalData(proposal.proposalData),
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
      documentContent: documentContentMap.get(proposal.id),
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
