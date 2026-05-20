import { and, db, eq, exists, isNull, notInArray } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  proposalCategories,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
} from '../access';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ListAllProposalsInput {
  processInstanceId: string;
  status?: ProposalStatus;
  categoryId?: string;
  cursor?: string | null;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  dir?: 'asc' | 'desc';
  authUserId: string;
}

/**
 * Returns every valid (non-draft, non-rejected, non-duplicate, non-deleted,
 * non-hidden) proposal on the instance. All process members see the same set
 * — no admin-only branching. Used by the "All proposals" tab on the results
 * page so members can browse the full submission set after a limiting
 * pipeline has narrowed the phase.
 */
export const listAllProposals = async ({
  input,
  user,
}: {
  input: ListAllProposalsInput;
  user: User;
}) => {
  const { processInstanceId, status, categoryId } = input;
  const limit = input.limit ?? 20;
  const orderBy = input.orderBy ?? 'createdAt';
  const dir = input.dir ?? 'desc';

  const decodedCursor = input.cursor
    ? decodeCursor<{ value: string | Date }>(input.cursor)
    : undefined;

  const [currentProfileId, instance] = await Promise.all([
    getCurrentProfileId(input.authUserId),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  await assertInstanceProfileAccess({
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
          eq(table.visibility, Visibility.VISIBLE),
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

  const [relationshipData, documentContentMap] = await Promise.all([
    getProposalRelationshipData({ profileIds, currentProfileId }),
    getProposalDocumentsContent(
      pageItems.map((proposal) => ({
        id: proposal.id,
        proposalData: proposal.proposalData,
        proposalTemplate,
      })),
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
