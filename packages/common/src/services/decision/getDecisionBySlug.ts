import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
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
        steward: { with: { avatarImage: true } },
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
  processInstance: NonNullable<LoadedDecisionProfile['processInstance']>;
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

  // Proposal/participant aggregates are intentionally NOT computed here: the
  // overview route (this endpoint's only consumer) never renders them, and
  // list views get their counts from listDecisionProfiles. Keeping the
  // hot-path slug fetch aggregate-free saves a proposals table scan per view.
  await assertProfileAccess({
    user,
    profileId: profile.id,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    notMemberMessage: 'User does not have access to this process',
  });

  return {
    ...profile,
    processInstance: instance,
  };
};
