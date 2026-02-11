import { db } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import type { User } from '@op/supabase/lib';

import { acceptProfileInvite } from '../profile/acceptProfileInvite';

/**
 * Accept a proposal invite and ensure the user is also a member
 * of the parent decision process.
 */
export const acceptProposalInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) => {
  // 1. Accept the proposal invite (creates profileUser for the proposal)
  const result = await acceptProfileInvite({ inviteId, user });

  // 2. Get the invite to find the proposal's profileId
  const invite = await db.query.profileInvites.findFirst({
    where: { id: inviteId },
  });

  if (!invite) {
    return result;
  }

  // 3. Find the proposal and its process instance
  const proposal = await db.query.proposals.findFirst({
    where: { profileId: invite.profileId },
    with: {
      processInstance: true,
    },
  });

  if (!proposal?.processInstance?.profileId) {
    // Legacy instance without a profile - nothing to do
    return result;
  }

  const decisionProfileId = proposal.processInstance.profileId;

  // 4. Check for an existing pending invite on the decision process for this user
  const pendingDecisionInvite = await db.query.profileInvites.findFirst({
    where: {
      profileId: decisionProfileId,
      email: user.email!.toLowerCase(),
      acceptedOn: { isNull: true },
    },
  });

  if (pendingDecisionInvite) {
    // Accept the existing decision process invite
    await acceptProfileInvite({ inviteId: pendingDecisionInvite.id, user });
    return result;
  }

  // 5. Check if user is already a member of the decision process
  const existingMembership = await db.query.profileUsers.findFirst({
    where: {
      profileId: decisionProfileId,
      authUserId: user.id,
    },
  });

  if (existingMembership) {
    // Already a member - nothing to do
    return result;
  }

  // 6. Create profileUser with Member role on the decision process
  await db.transaction(async (tx) => {
    const [decisionProfileUser] = await tx
      .insert(profileUsers)
      .values({
        authUserId: user.id,
        profileId: decisionProfileId,
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0],
      })
      .returning();

    if (!decisionProfileUser) {
      return;
    }

    await tx.insert(profileUserToAccessRoles).values({
      profileUserId: decisionProfileUser.id,
      accessRoleId: ROLES.MEMBER.id,
    });
  });

  return result;
};
