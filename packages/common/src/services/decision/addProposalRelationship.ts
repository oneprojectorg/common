import { ProfileRelationshipType } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { addRelationship } from '../profile/profileRelationships';
import {
  type ProposalEngagementTarget,
  assertProposalEngagementAccess,
} from './assertProposalEngagementAccess';

/**
 * Like/follow a proposal on behalf of the caller. Asserts engagement access
 * first (proposal-only targets, SUBMIT_PROPOSALS on the parent decision) so
 * the permission check travels with the service wherever it's used, then
 * returns the resolved proposal/process ids for channel registration and
 * analytics.
 */
export const addProposalRelationship = async ({
  user,
  targetProfileId,
  relationshipType,
}: {
  user: User;
  targetProfileId: string;
  relationshipType: ProfileRelationshipType;
}): Promise<ProposalEngagementTarget> => {
  const target = await assertProposalEngagementAccess({
    user,
    profileId: targetProfileId,
  });

  await addRelationship({
    targetProfileId,
    relationshipType,
    authUserId: user.id,
  });

  return target;
};
