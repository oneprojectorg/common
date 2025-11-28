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
    typeof db.query.profiles.findFirst<typeof decisionProfileQueryConfig>
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

export const getDecisionBySlug = async ({
  user,
  slug,
}: {
  user: User;
  slug: string;
}): Promise<DecisionProfileItem> => {
  const [authAndStatsResult, profile] = await Promise.all([
    // Auth check + aggregations
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
          eq(profileUsers.authUserId, user.id),
        ),
      )
      .innerJoin(processInstances, eq(processInstances.profileId, profiles.id))
      // left join to remove processes that don't exist
      .leftJoin(proposals, eq(proposals.processInstanceId, processInstances.id))
      .where(
        and(eq(profiles.type, EntityType.DECISION), eq(profiles.slug, slug)),
      )
      .groupBy(profiles.id)
      .limit(1)
      .then((rows) => {
        if (rows.length === 0) {
          // If auth failed throw immediately and don't wait for the other results
          throw new UnauthorizedError(
            'User does not have access to this process',
          );
        }
        return rows[0];
      }),
    // Full profile data
    db.query.profiles.findFirst({
      where: and(
        eq(profiles.slug, slug),
        eq(profiles.type, EntityType.DECISION),
      ),
      ...decisionProfileQueryConfig,
    }),
  ]);

  if (!authAndStatsResult || !profile?.processInstance) {
    throw new NotFoundError('Decision profile not found');
  }

  return {
    ...profile,
    processInstance: {
      ...profile.processInstance,
      proposalCount: Number(authAndStatsResult.proposalCount),
      participantCount: Number(authAndStatsResult.participantCount),
    },
  };
};
