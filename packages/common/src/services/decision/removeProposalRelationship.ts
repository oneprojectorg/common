import { ProfileRelationshipType } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { removeRelationship } from '../profile/profileRelationships';
import {
  type ProposalEngagementTarget,
  assertProposalEngagementAccess,
} from './assertProposalEngagementAccess';

/**
 * Unlike/unfollow a proposal on behalf of the caller. Counterpart of
 * `addProposalRelationship` — same engagement gate, asserted here so the
 * permission check travels with the service.
 */
export const removeProposalRelationship = async ({
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

  await removeRelationship({
    targetProfileId,
    relationshipType,
    authUserId: user.id,
  });

  return target;
};
