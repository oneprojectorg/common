import { and, count, countDistinct, db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profileUsers,
  profiles,
  proposals,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { acceptProfileInvite } from '../profile/acceptProfileInvite';

const decisionProfileQueryConfig = {
  with: {
    headerImage: true,
    avatarImage: true,
    processInstance: {
      with: {
        process: true,
        owner: {
          with: {
            avatarImage: true,
            organization: true,
          },
        },
      },
    },
  },
} as const;

type DecisionProfileQueryResult = Awaited<
  ReturnType<
    typeof db._query.profiles.findFirst<typeof decisionProfileQueryConfig>
  >
>;

type DecisionProfileItem = NonNullable<
  Omit<DecisionProfileQueryResult, 'processInstance'>
> & {
  processInstance: NonNullable<
    NonNullable<DecisionProfileQueryResult>['processInstance']
  > & {
    proposalCount: number;
    participantCount: number;
  };
};

const getAuthAndStats = (userId: string, slug: string) =>
  db
    .select({
      profileId: profiles.id,
      proposalCount: count(proposals.id),
      participantCount: countDistinct(proposals.submittedByProfileId),
    })
    .from(profiles)
    .innerJoin(
      profileUsers,
      and(
        eq(profileUsers.profileId, profiles.id),
        eq(profileUsers.authUserId, userId),
      ),
    )
    .innerJoin(processInstances, eq(processInstances.profileId, profiles.id))
    .leftJoin(proposals, eq(proposals.processInstanceId, processInstances.id))
    .where(and(eq(profiles.type, EntityType.DECISION), eq(profiles.slug, slug)))
    .groupBy(profiles.id)
    .limit(1)
    .then((rows) => rows[0] ?? null);

export const getDecisionBySlug = async ({
  user,
  slug,
}: {
  user: User;
  slug: string;
}): Promise<DecisionProfileItem> => {
  const [authAndStatsResult, profile] = await Promise.all([
    getAuthAndStats(user.id, slug),
    db._query.profiles.findFirst({
      where: and(
        eq(profiles.slug, slug),
        eq(profiles.type, EntityType.DECISION),
      ),
      ...decisionProfileQueryConfig,
    }),
  ]);

  if (!profile?.processInstance) {
    throw new NotFoundError('Decision profile not found');
  }

  // If the user has access, return immediately
  if (authAndStatsResult) {
    return {
      ...profile,
      processInstance: {
        ...profile.processInstance,
        proposalCount: authAndStatsResult.proposalCount,
        participantCount: authAndStatsResult.participantCount,
      },
    };
  }

  // No access — check for a pending invite and auto-accept it
  if (user.email) {
    const pendingInvite = await db.query.profileInvites.findFirst({
      where: {
        profileId: profile.id,
        email: user.email.toLowerCase(),
        acceptedOn: { isNull: true },
      },
    });

    if (pendingInvite) {
      await acceptProfileInvite({ inviteId: pendingInvite.id, user });

      const retryResult = await getAuthAndStats(user.id, slug);
      if (retryResult) {
        return {
          ...profile,
          processInstance: {
            ...profile.processInstance,
            proposalCount: retryResult.proposalCount,
            participantCount: retryResult.participantCount,
          },
        };
      }
    }
  }

  throw new UnauthorizedError('User does not have access to this process');
};
