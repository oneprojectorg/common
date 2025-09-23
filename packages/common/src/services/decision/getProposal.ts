import { and, db, eq, count } from '@op/db/client';
import {
  ProfileRelationshipType,
  posts,
  postsToProfiles,
  profileRelationships,
  proposals,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const getProposal = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.profileId, profileId),
      with: {
        processInstance: {
          with: {
            process: true,
            owner: true,
          },
        },
        submittedBy: {
          with: {
            avatarImage: true,
          },
        },
        profile: true,
        decisions: {
          with: {
            decidedBy: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    // Check if current user has liked/followed this proposal (if it has a profile)
    let isLikedByUser = false;
    let isFollowedByUser = false;

    if (proposal.profileId) {
      const userRelationships = await db
        .select({ relationshipType: profileRelationships.relationshipType })
        .from(profileRelationships)
        .where(
          and(
            eq(profileRelationships.sourceProfileId, dbUser.currentProfileId),
            eq(profileRelationships.targetProfileId, proposal.profileId),
          ),
        );

      isLikedByUser = userRelationships.some(
        (rel) => rel.relationshipType === ProfileRelationshipType.LIKES,
      );
      isFollowedByUser = userRelationships.some(
        (rel) => rel.relationshipType === ProfileRelationshipType.FOLLOWING,
      );
    }

    // Get comment count for this proposal
    let commentsCount = 0;
    if (proposal.profileId) {
      const commentCountResult = await db
        .select({ count: count() })
        .from(posts)
        .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
        .where(eq(postsToProfiles.profileId, proposal.profileId));

      commentsCount = Number(commentCountResult[0]?.count || 0);
    }

    // TODO: Add access control - check if user can view this proposal
    // For now, any authenticated user can view any proposal

    return {
      ...proposal,
      isLikedByUser,
      isFollowedByUser,
      commentsCount,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching proposal:', error);
    throw new NotFoundError('Proposal not found');
  }
};
