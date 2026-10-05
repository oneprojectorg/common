import { and, db, eq, inArray } from '@op/db/client';
import {
  ProfileRelationshipType,
  posts,
  postsToProfiles,
  profileRelationships,
} from '@op/db/schema';
import { count as countFn } from 'drizzle-orm';
import { z } from 'zod';

import { getMergedLikeCounts } from './proposalSupersession';
import { proposalSchema } from './schemas/proposal';

const proposalRelationshipDataSchema = proposalSchema
  .pick({
    likesCount: true,
    followersCount: true,
    isLikedByUser: true,
    isFollowedByUser: true,
    commentsCount: true,
  })
  .required();

type ProposalRelationshipData = z.infer<typeof proposalRelationshipDataSchema>;

/**
 * Fetches like/follow counts, the caller's own like/follow state, and comment
 * counts for a set of proposal profile IDs in four parallel queries, then
 * folds them into a single per-profile map. Used by both `listProposals` and
 * `listAllProposals` to build proposal cards' engagement metrics.
 */
export const getProposalRelationshipData = async ({
  profileIds,
  currentProfileId,
}: {
  profileIds: string[];
  currentProfileId?: string;
}): Promise<Map<string, ProposalRelationshipData>> => {
  const relationshipData = new Map<string, ProposalRelationshipData>();

  if (profileIds.length === 0) {
    return relationshipData;
  }

  const [relationshipCounts, userRelationships, commentCounts, mergedLikes] =
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

      currentProfileId
        ? db
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
            )
        : Promise.resolve([]),

      db
        .select({
          profileId: postsToProfiles.profileId,
          count: countFn(),
        })
        .from(posts)
        .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
        .where(inArray(postsToProfiles.profileId, profileIds))
        .groupBy(postsToProfiles.profileId),

      getMergedLikeCounts({ targetProfileIds: profileIds }),
    ]);

  const likeCounts = new Map<string, number>();
  const followerCounts = new Map<string, number>();
  for (const row of relationshipCounts) {
    if (row.relationshipType === ProfileRelationshipType.LIKES) {
      likeCounts.set(row.targetProfileId, Number(row.count));
    } else if (row.relationshipType === ProfileRelationshipType.FOLLOWING) {
      followerCounts.set(row.targetProfileId, Number(row.count));
    }
  }

  const likedByUser = new Set<string>();
  const followedByUser = new Set<string>();
  for (const row of userRelationships) {
    if (row.relationshipType === ProfileRelationshipType.LIKES) {
      likedByUser.add(row.targetProfileId);
    } else if (row.relationshipType === ProfileRelationshipType.FOLLOWING) {
      followedByUser.add(row.targetProfileId);
    }
  }

  const commentsByProfile = new Map(
    commentCounts.map((row) => [row.profileId, Number(row.count)]),
  );

  for (const profileId of profileIds) {
    relationshipData.set(profileId, {
      // Likes carry over from merged proposals; follows do not.
      likesCount:
        (likeCounts.get(profileId) ?? 0) + (mergedLikes.get(profileId) ?? 0),
      followersCount: followerCounts.get(profileId) ?? 0,
      isLikedByUser: likedByUser.has(profileId),
      isFollowedByUser: followedByUser.has(profileId),
      commentsCount: commentsByProfile.get(profileId) ?? 0,
    });
  }

  return relationshipData;
};
