import { db, eq } from '@op/db/client';
import {
  profileInvites,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import type { User } from '@op/supabase/lib';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';

/**
 * Accept a proposal invite and ensure the user is also added as a Member
 * of the parent decision process — all within a single transaction.
 */
export const acceptProposalInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) => {
  const email = user.email;
  if (!email) {
    // email can be null for non-email accounts and in the auth DB it is nullable.
    throw new UnauthorizedError('User must have an email address');
  }

  // ── Validation & reads ──

  // 1. Find and validate the proposal invite
  const invite = await db.query.profileInvites.findFirst({
    where: { id: inviteId },
  });

  if (!invite) {
    throw new NotFoundError('Invite', inviteId);
  }

  if (invite.acceptedOn) {
    throw new ConflictError('This invite has already been accepted');
  }

  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new UnauthorizedError('This invite is for a different email address');
  }

  // 2. Check user isn't already a member of the proposal profile
  const existingProposalMembership = await db.query.profileUsers.findFirst({
    where: { profileId: invite.profileId, authUserId: user.id },
  });

  if (existingProposalMembership) {
    throw new CommonError('You are already a member of this profile');
  }

  // 3. Find the proposal and its process instance
  const proposal = await db.query.proposals.findFirst({
    where: { profileId: invite.profileId },
    with: { processInstance: true },
  });

  // 4. Check if we need to add the user to the parent decision process
  let decisionProfileId: string | null = null;
  let pendingDecisionInvite: typeof invite | null = null;

  if (proposal?.processInstance?.profileId) {
    const existingDecisionMembership = await db.query.profileUsers.findFirst({
      where: {
        profileId: proposal.processInstance.profileId,
        authUserId: user.id,
      },
    });

    if (!existingDecisionMembership) {
      decisionProfileId = proposal.processInstance.profileId;

      pendingDecisionInvite =
        (await db.query.profileInvites.findFirst({
          where: {
            profileId: decisionProfileId,
            email: email.toLowerCase(),
            acceptedOn: { isNull: true },
          },
        })) ?? null;
    }
  }

  // ── Single transaction for all writes ──

  const profileUser = await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const userName = user.user_metadata?.name || email.split('@')[0];
    const userValues = {
      authUserId: user.id,
      email,
      name: userName,
    };

    // 1. Insert profileUsers in parallel
    const [proposalUser, decisionUser] = await Promise.all([
      tx
        .insert(profileUsers)
        .values({ ...userValues, profileId: invite.profileId })
        .returning(),
      decisionProfileId
        ? tx
            .insert(profileUsers)
            .values({ ...userValues, profileId: decisionProfileId })
            .returning()
        : null,
    ]);

    const proposalProfileUser = proposalUser[0];
    if (!proposalProfileUser) {
      throw new CommonError('Failed to create profile user');
    }

    const decisionProfileUser = decisionUser?.[0];
    if (decisionProfileId && !decisionProfileUser) {
      throw new CommonError(
        'Failed to create profile user for decision process',
      );
    }

    // 2. Assign roles and mark invites accepted in parallel
    const followUpWrites: Promise<unknown>[] = [
      tx.insert(profileUserToAccessRoles).values({
        profileUserId: proposalProfileUser.id,
        accessRoleId: invite.accessRoleId,
      }),
      tx
        .update(profileInvites)
        .set({ acceptedOn: now })
        .where(eq(profileInvites.id, inviteId)),
    ];

    if (decisionProfileUser) {
      followUpWrites.push(
        tx.insert(profileUserToAccessRoles).values({
          profileUserId: decisionProfileUser.id,
          accessRoleId: pendingDecisionInvite?.accessRoleId ?? ROLES.MEMBER.id,
        }),
      );

      if (pendingDecisionInvite) {
        followUpWrites.push(
          tx
            .update(profileInvites)
            .set({ acceptedOn: now })
            .where(eq(profileInvites.id, pendingDecisionInvite.id)),
        );
      }
    }

    await Promise.all(followUpWrites);

    return proposalProfileUser;
  });

  return { profileUser };
};
