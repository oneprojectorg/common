import { and, db, eq, inArray } from '@op/db/client';
import {
  ProfileRelationshipType,
  posts,
  postsToProfiles,
  profileRelationships,
} from '@op/db/schema';
import { count as countFn } from 'drizzle-orm';

export interface ProposalRelationshipData {
  likesCount: number;
  followersCount: number;
  isLikedByUser: boolean;
  isFollowedByUser: boolean;
  commentsCount: number;
}

/**
 * Fetches like/follow counts, the caller's own like/follow state, and comment
 * counts for a set of proposal profile IDs in three parallel queries, then
 * folds them into a single per-profile map. Used by both `listProposals` and
 * `listAllProposals` to build proposal cards' engagement metrics.
 */
export const getProposalRelationshipData = async ({
  profileIds,
  currentProfileId,
}: {
  profileIds: string[];
  currentProfileId: string;
}): Promise<Map<string, ProposalRelationshipData>> => {
  const relationshipData = new Map<string, ProposalRelationshipData>();

  if (profileIds.length === 0) {
    return relationshipData;
  }

  const [relationshipCounts, userRelationships, commentCounts] =
    await Promise.all([
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
    ]);

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

  return relationshipData;
};
