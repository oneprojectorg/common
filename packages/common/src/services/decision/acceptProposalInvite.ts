import { db, eq } from '@op/db/client';
import {
  profileInvites,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';
import { assertGlobalRole } from '../assert';

/**
 * Accept a proposal invite and ensure the user is also added as a Member
 * of the parent decision process
 */
export const acceptProposalInvite = async ({
  profileId: proposalProfileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  const email = user.email;
  if (!email) {
    // email can be null for non-email accounts and in the auth DB it is nullable.
    throw new UnauthorizedError('User must have an email address');
  }

  const invite = await db.query.profileInvites.findFirst({
    where: {
      profileId: proposalProfileId,
      email: email.toLowerCase(),
      acceptedOn: { isNull: true },
    },
  });

  if (!invite) {
    throw new NotFoundError('No pending invite found for this proposal');
  }

  if (invite.acceptedOn) {
    throw new ConflictError('This invite has already been accepted');
  }

  // Check user isn't already a member of the proposal profile
  const existingProposalMembership = await db.query.profileUsers.findFirst({
    where: { profileId: invite.profileId, authUserId: user.id },
  });

  if (existingProposalMembership) {
    throw new CommonError('You are already a member of this profile');
  }

  // Find the proposal (and its process instance) and the Member role in parallel
  const [proposal, memberRole] = await Promise.all([
    db.query.proposals.findFirst({
      where: { profileId: invite.profileId },
      with: { processInstance: true },
    }),
    assertGlobalRole('Member'),
  ]);

  // Check if we need to add the user to the parent decision process
  let decisionProfileIdToAdd: string | null = null;
  let pendingDecisionInvite: typeof invite | null = null;

  if (proposal?.processInstance?.profileId) {
    const existingDecisionMembership = await db.query.profileUsers.findFirst({
      where: {
        profileId: proposal.processInstance.profileId,
        authUserId: user.id,
      },
    });

    if (!existingDecisionMembership) {
      decisionProfileIdToAdd = proposal.processInstance.profileId;

      pendingDecisionInvite =
        (await db.query.profileInvites.findFirst({
          where: {
            profileId: decisionProfileIdToAdd,
            email: email.toLowerCase(),
            acceptedOn: { isNull: true },
          },
        })) ?? null;
    }
  }

  // Write all data

  const profileUser = await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const userValues = {
      authUserId: user.id,
      email,
    };

    // Insert new profileUsers
    const [proposalUser, decisionUser] = await Promise.all([
      tx
        .insert(profileUsers)
        .values({ ...userValues, profileId: invite.profileId })
        .returning(),
      decisionProfileIdToAdd
        ? tx
            .insert(profileUsers)
            .values({ ...userValues, profileId: decisionProfileIdToAdd })
            .returning()
        : null,
    ]);

    const proposalProfileUser = proposalUser[0];
    if (!proposalProfileUser) {
      throw new CommonError('Failed to create profile user');
    }

    const decisionProfileUser = decisionUser?.[0];
    if (decisionProfileIdToAdd && !decisionProfileUser) {
      throw new CommonError(
        'Failed to create profile user for decision process',
      );
    }

    // Assign roles and mark invites accepted
    const followUpWrites: Promise<unknown>[] = [
      tx.insert(profileUserToAccessRoles).values({
        profileUserId: proposalProfileUser.id,
        accessRoleId: invite.accessRoleId,
      }),
      tx
        .update(profileInvites)
        .set({ acceptedOn: now })
        .where(eq(profileInvites.id, invite.id)),
    ];

    if (decisionProfileUser) {
      followUpWrites.push(
        tx.insert(profileUserToAccessRoles).values({
          profileUserId: decisionProfileUser.id,
          accessRoleId: pendingDecisionInvite?.accessRoleId ?? memberRole.id,
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
