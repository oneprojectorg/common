import {
  and,
  asc,
  db,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
} from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  posts,
  postsToProfiles,
  processInstances,
  profileRelationships,
  profileUsers,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  getProfileAccessUser,
} from '../access';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ListAllProposalsInput {
  processInstanceId: string;
  status?: ProposalStatus;
  categoryId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  dir?: 'asc' | 'desc';
  authUserId: string;
}

const buildBaseWhereConditions = (input: ListAllProposalsInput) => {
  const { processInstanceId, status } = input;

  const conditions = [eq(proposals.processInstanceId, processInstanceId)];

  if (status) {
    conditions.push(eq(proposals.status, status));
  }

  return and(...conditions);
};

/**
 * Returns every valid (non-draft, non-rejected, non-duplicate, non-deleted)
 * proposal on the instance, regardless of phase scoping. HIDDEN visibility
 * is still applied for non-admin callers. Used by the "All proposals" tab on
 * the results page so reviewers can browse the full submission set after a
 * limiting pipeline has narrowed the phase.
 */
export const listAllProposals = async ({
  input,
  user,
}: {
  input: ListAllProposalsInput;
  user: User;
}) => {
  const { processInstanceId } = input;

  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const currentProfileId = await getCurrentProfileId(input.authUserId);

  const instanceRows = await db
    .select({
      id: processInstances.id,
      profileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
      instanceData: processInstances.instanceData,
      processId: processInstances.processId,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  const instance = instanceRows[0];
  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }
  const instanceProfileId = instance.profileId;

  const profileUserResolved = await getProfileAccessUser({
    user,
    profileId: instanceProfileId,
  });
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
  const canManageProposals = checkPermission(
    { profile: permission.ADMIN },
    profileUserResolved?.roles ?? [],
  );

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  let whereClause = buildBaseWhereConditions(input);

  const { categoryId } = input;
  if (categoryId) {
    const proposalIdsInCategory = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));

    if (proposalIdsInCategory.length === 0) {
      return { proposals: [], total: 0, hasMore: false, canManageProposals };
    }

    whereClause = and(
      whereClause,
      inArray(
        proposals.id,
        proposalIdsInCategory.map((p) => p.proposalId),
      ),
    );
  }

  // Valid = non-draft, non-rejected, non-duplicate, non-deleted. Visibility
  // (HIDDEN) still hides proposals from non-admin, non-owner callers.
  const validStatusFilter = notInArray(proposals.status, [
    ProposalStatus.DRAFT,
    ProposalStatus.REJECTED,
    ProposalStatus.DUPLICATE,
  ]);
  const deletedAtFilter = isNull(proposals.deletedAt);

  const validFilter = canManageProposals
    ? and(validStatusFilter, deletedAtFilter)
    : and(
        validStatusFilter,
        deletedAtFilter,
        or(
          eq(proposals.visibility, Visibility.VISIBLE),
          inArray(
            proposals.profileId,
            db
              .select({ profileId: profileUsers.profileId })
              .from(profileUsers)
              .where(eq(profileUsers.authUserId, input.authUserId)),
          ),
        ),
      );

  whereClause = and(whereClause, validFilter);

  const orderColumn = proposals[orderBy] ?? proposals.createdAt;
  const orderFn = dir === 'asc' ? asc : desc;

  const [proposalList, countResult] = await Promise.all([
    db._query.proposals.findMany({
      where: whereClause,
      with: {
        submittedBy: {
          with: {
            avatarImage: true,
          },
        },
        profile: true,
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    }),
    db.select({ count: countFn() }).from(proposals).where(whereClause),
  ]);

  const count = countResult[0]?.count || 0;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  type ProposalListItem = (typeof proposalList)[number];

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const relationshipData = new Map<
    string,
    {
      likesCount: number;
      followersCount: number;
      isLikedByUser: boolean;
      isFollowedByUser: boolean;
      commentsCount: number;
    }
  >();

  const [relationshipResults, documentContentMap] = await Promise.all([
    profileIds.length > 0
      ? Promise.all([
          db
            .select({
              targetProfileId: profileRelationships.targetProfileId,
              relationshipType: profileRelationships.relationshipType,
              count: countFn(),
            })
            .from(profileRelationships)
            .where(inArray(profileRelationships.targetProfileId, profileIds))
            .groupBy(
              profileRelationships.targetProfileId,
              profileRelationships.relationshipType,
            ),

          db
            .select({
              targetProfileId: profileRelationships.targetProfileId,
              relationshipType: profileRelationships.relationshipType,
            })
            .from(profileRelationships)
            .where(
              and(
                eq(profileRelationships.sourceProfileId, currentProfileId),
                inArray(profileRelationships.targetProfileId, profileIds),
              ),
            ),

          db
            .select({
              profileId: postsToProfiles.profileId,
              count: countFn(),
            })
            .from(posts)
            .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
            .where(inArray(postsToProfiles.profileId, profileIds))
            .groupBy(postsToProfiles.profileId),
        ])
      : Promise.resolve(null),

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
    ),
  ]);

  if (relationshipResults) {
    const [relationshipCounts, userRelationships, commentCounts] =
      relationshipResults;

    for (const profileId of profileIds) {
      const likesCount =
        relationshipCounts.find(
          (rc) =>
            rc.targetProfileId === profileId &&
            rc.relationshipType === ProfileRelationshipType.LIKES,
        )?.count || 0;

      const followersCount =
        relationshipCounts.find(
          (rc) =>
            rc.targetProfileId === profileId &&
            rc.relationshipType === ProfileRelationshipType.FOLLOWING,
        )?.count || 0;

      const isLikedByUser = userRelationships.some(
        (ur) =>
          ur.targetProfileId === profileId &&
          ur.relationshipType === ProfileRelationshipType.LIKES,
      );

      const isFollowedByUser = userRelationships.some(
        (ur) =>
          ur.targetProfileId === profileId &&
          ur.relationshipType === ProfileRelationshipType.FOLLOWING,
      );

      const commentsCount =
        commentCounts.find((cc) => cc.profileId === profileId)?.count || 0;

      relationshipData.set(profileId, {
        likesCount: Number(likesCount),
        followersCount: Number(followersCount),
        isLikedByUser,
        isFollowedByUser,
        commentsCount: Number(commentsCount),
      });
    }
  }

  const proposalsWithCounts = proposalList.map((proposal: ProposalListItem) => {
    const submittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = proposal.profileId
      ? relationshipData.get(proposal.profileId)
      : null;

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: parseProposalData(proposal.proposalData),
      status: proposal.status,
      visibility: proposal.visibility,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      profileId: proposal.profileId,
      submittedBy: submittedBy,
      profile: profile,
      likesCount: relationshipInfo?.likesCount || 0,
      followersCount: relationshipInfo?.followersCount || 0,
      isLikedByUser: relationshipInfo?.isLikedByUser || false,
      isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
      commentsCount: relationshipInfo?.commentsCount || 0,
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate,
    };
  });

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore: offset + limit < Number(count),
    canManageProposals,
  };
};
