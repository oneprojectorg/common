import { and, countDistinct, db, eq, ne } from '@op/db/client';
import { EntityType, ProposalStatus, proposals } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';

const decisionProfileQueryConfig = {
  with: {
    headerImage: true,
    avatarImage: true,
    processInstance: {
      with: {
        process: true,
        owner: { with: { avatarImage: true, organization: true } },
        steward: true,
      },
    },
  },
} as const;

type LoadedDecisionProfile = NonNullable<
  Awaited<
    ReturnType<
      typeof db.query.profiles.findFirst<typeof decisionProfileQueryConfig>
    >
  >
>;

type DecisionProfileItem = Omit<LoadedDecisionProfile, 'processInstance'> & {
  processInstance: NonNullable<LoadedDecisionProfile['processInstance']> & {
    proposalCount: number;
    participantCount: number;
  };
};

export const getDecisionBySlug = async ({
  user,
  slug,
}: {
  user: User | undefined;
  slug: string;
}): Promise<DecisionProfileItem> => {
  const profile = await db.query.profiles.findFirst({
    where: { slug, type: EntityType.DECISION },
    ...decisionProfileQueryConfig,
  });

  if (!profile?.processInstance) {
    // No readable decision with this slug. Don't distinguish "missing" from
    // "no access" — surfacing a 404 would leak which decisions exist.
    throw new UnauthorizedError('User does not have access to this process');
  }

  const instance = profile.processInstance;

  // Read-access gate alongside the proposal aggregates. A rejected caller never
  // sees the aggregates: the assert and the query share one Promise.all, so a
  // failed assert rejects the whole thing.
  const [, statsRows] = await Promise.all([
    assertProfileAccess({
      user,
      profileId: profile.id,
      permissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
      notMemberMessage: 'User does not have access to this process',
    }),
    db
      .select({
        proposalCount: countDistinct(proposals.id),
        participantCount: countDistinct(proposals.submittedByProfileId),
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instance.id),
          ne(proposals.status, ProposalStatus.DRAFT),
        ),
      ),
  ]);

  return {
    ...profile,
    processInstance: {
      ...instance,
      proposalCount: statsRows[0]?.proposalCount ?? 0,
      participantCount: statsRows[0]?.participantCount ?? 0,
    },
  };
};
