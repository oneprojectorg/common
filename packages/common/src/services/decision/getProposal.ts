import { and, count, db, eq } from '@op/db/client';
import {
  ProfileRelationshipType,
  organizations,
  posts,
  postsToProfiles,
  processInstances,
  profileRelationships,
  proposals,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

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

    // Get engagement counts for this proposal
    let commentsCount = 0;
    let likesCount = 0;
    let followersCount = 0;

    if (proposal.profileId) {
      // Run all count queries in parallel for better performance
      const [commentCountResult, likesCountResult, followersCountResult] =
        await Promise.all([
          // Get comment count
          db
            .select({ count: count() })
            .from(posts)
            .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
            .where(eq(postsToProfiles.profileId, proposal.profileId)),

          // Get likes count
          db
            .select({ count: count() })
            .from(profileRelationships)
            .where(
              and(
                eq(profileRelationships.targetProfileId, proposal.profileId),
                eq(
                  profileRelationships.relationshipType,
                  ProfileRelationshipType.LIKES,
                ),
              ),
            ),

          // Get followers count
          db
            .select({ count: count() })
            .from(profileRelationships)
            .where(
              and(
                eq(profileRelationships.targetProfileId, proposal.profileId),
                eq(
                  profileRelationships.relationshipType,
                  ProfileRelationshipType.FOLLOWING,
                ),
              ),
            ),
        ]);

      commentsCount = Number(commentCountResult[0]?.count || 0);
      likesCount = Number(likesCountResult[0]?.count || 0);
      followersCount = Number(followersCountResult[0]?.count || 0);
    }

    // Check if proposal is editable by current user
    const isOwner = proposal.submittedByProfileId === dbUser.currentProfileId;
    let isEditable = isOwner;

    if (
      !isEditable &&
      proposal.processInstance &&
      'id' in proposal.processInstance
    ) {
      // Get the organization for the process instance
      const instanceOrg = await db
        .select({
          id: organizations.id,
        })
        .from(organizations)
        .leftJoin(
          processInstances,
          eq(organizations.profileId, processInstances.ownerProfileId),
        )
        .where(eq(processInstances.id, proposal.processInstance.id as string))
        .limit(1);

      if (instanceOrg[0]) {
        const orgUser = await getOrgAccessUser({
          user,
          organizationId: instanceOrg[0].id,
        });

        const hasAdminPermission = checkPermission(
          { decisions: permission.ADMIN },
          orgUser?.roles ?? [],
        );

        isEditable = hasAdminPermission;
      }
    }

    // TODO: Add access control - check if user can view this proposal
    // For now, any authenticated user can view any proposal

    return {
      ...proposal,
      commentsCount,
      likesCount,
      followersCount,
      isEditable,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching proposal:', error);
    throw new NotFoundError('Proposal not found');
  }
};
