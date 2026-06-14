import {
  and,
  db,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  or,
} from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  proposalCategories,
  profileUsers,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

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
    ? decodeCursor<{ value: string | Date }>(input.cursor)
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

  const profileUser = await assertInstanceProfileAccess({
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
    profileUser?.roles ?? [],
  );

  const proposalList = await db.query.proposals.findMany({
    where: {
      RAW: (table) =>
        and(
          eq(table.processInstanceId, processInstanceId),
          status ? eq(table.status, status) : undefined,
          categoryId
            ? exists(
                db
                  .select({ id: proposalCategories.proposalId })
                  .from(proposalCategories)
                  .where(
                    and(
                      eq(proposalCategories.proposalId, table.id),
                      eq(proposalCategories.taxonomyTermId, categoryId),
                    ),
                  ),
              )
            : undefined,
          notInArray(table.status, [
            ProposalStatus.DRAFT,
            ProposalStatus.REJECTED,
            ProposalStatus.DUPLICATE,
          ]),
          isNull(table.deletedAt),
          isAdmin ? undefined : eq(table.visibility, Visibility.VISIBLE),
          // Items with an active moderation flag are hidden from everyone
          // except members of the proposal's own profile (the same audience
          // getProposal grants it to, so list and detail agree); admins skip
          // the filter.
          isAdmin
            ? undefined
            : or(
                noActiveModerationFlag('proposal', table.id),
                inArray(
                  table.profileId,
                  db
                    .select({ profileId: profileUsers.profileId })
                    .from(profileUsers)
                    .where(inArray(profileUsers.authUserId, accessUserIds)),
                ),
              ),
          getCursorCondition({
            column: table[orderBy],
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
    orderBy: (table, { asc, desc }) =>
      dir === 'asc' ? asc(table[orderBy]) : desc(table[orderBy]),
  });

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
  const next =
    hasMore && cursorValue
      ? encodeCursor<{ value: string | Date }>({ value: cursorValue })
      : null;

  return { items, next };
};
