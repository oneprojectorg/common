import { and, db, eq, inArray } from '@op/db/client';
import { EntityType, processInstances, profileUsers, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

// Query configuration for fetching decision profile with relations
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
        proposals: {
          columns: {
            id: true,
            submittedByProfileId: true,
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

export const getDecisionProfileBySlug = async ({
  user,
  slug,
}: {
  user: User;
  slug: string;
}): Promise<DecisionProfileItem | null> => {
  const typeCondition = eq(profiles.type, EntityType.DECISION);
  const slugCondition = eq(profiles.slug, slug);

  // Filter profiles to only those the user has access to via profileUsers
  const authorizationCondition = inArray(
    profiles.id,
    db
      .select({ profileId: profileUsers.profileId })
      .from(profileUsers)
      .where(eq(profileUsers.authUserId, user.id)),
  );

  // Filter to only profiles that have a processInstance
  const hasProcessInstanceCondition = inArray(
    profiles.id,
    db.select({ profileId: processInstances.profileId }).from(processInstances),
  );

  const whereClause = and(
    typeCondition,
    slugCondition,
    authorizationCondition,
    hasProcessInstanceCondition,
  );

  const profile = await db.query.profiles.findFirst({
    where: whereClause,
    ...decisionProfileQueryConfig,
  });

  if (!profile || !profile.processInstance) {
    return null;
  }

  // Transform profile to include proposal and participant counts in processInstance
  const instance = profile.processInstance as {
    proposals: { id: string; submittedByProfileId: string | null }[];
    [key: string]: unknown;
  };
  const proposalCount = instance.proposals?.length ?? 0;
  const uniqueParticipants = new Set(
    instance.proposals?.map((proposal) => proposal.submittedByProfileId),
  );
  const participantCount = uniqueParticipants.size;

  return {
    ...profile,
    processInstance: {
      ...instance,
      proposalCount,
      participantCount,
    },
  } as DecisionProfileItem;
};
