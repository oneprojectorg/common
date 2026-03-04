import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { ProcessStatus, allowList, profileInvites } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import { decisionPermission } from '../decision/permissions';

// Utility function to generate consistent result messages
const generateInviteResultMessage = (
  successCount: number,
  totalEmails: number,
): string => {
  if (successCount === totalEmails) {
    return `All ${totalEmails} invitation${totalEmails > 1 ? 's' : ''} sent successfully`;
  } else if (successCount > 0) {
    return `${successCount} of ${totalEmails} invitations sent successfully`;
  } else {
    return 'No invitations were sent successfully';
  }
};

/**
 * Invite users to a profile with roles.
 * Each invitation specifies an email and roleId, allowing per-user role assignment.
 */
export const inviteUsersToProfile = async ({
  invitations,
  profileId,
  requesterProfileId,
  personalMessage,
  user,
}: {
  invitations: Array<{ email: string; roleId: string }>;
  profileId: string;
  requesterProfileId: string;
  personalMessage?: string;
  user: User;
}) => {
  if (invitations.length === 0) {
    throw new CommonError('At least one invitation is required');
  }

  const normalizedInvitations = invitations.map((inv) => ({
    email: inv.email.toLowerCase(),
    roleId: inv.roleId,
  }));

  const normalizedEmails = normalizedInvitations.map((inv) => inv.email);
  const uniqueRoleIds = [
    ...new Set(normalizedInvitations.map((inv) => inv.roleId)),
  ];

  const [
    profile,
    requesterProfile,
    targetRoles,
    existingUsers,
    existingAllowListEntries,
    existingPendingInvites,
    profileUser,
    proposalWithDecision,
    processInstanceForProfile,
  ] = await Promise.all([
    // Get the target profile details
    assertProfile(profileId),
    // Get the requester's profile for the inviter name
    assertProfile(requesterProfileId),
    // Get all target roles with their zone permissions (needed to detect admin roles)
    db.query.accessRoles.findMany({
      where: { id: { in: uniqueRoleIds } },
      with: {
        zonePermissions: {
          with: { accessZone: true },
        },
      },
    }),
    // Get all users with their profile memberships for this profile
    db._query.users.findMany({
      where: (table, { inArray }) => inArray(table.email, normalizedEmails),
      with: {
        profileUsers: {
          where: (table, { eq }) => eq(table.profileId, profileId),
        },
      },
    }),
    // Get all existing allowList entries for these emails
    db.query.allowList.findMany({
      where: { email: { in: normalizedEmails } },
    }),
    // Get existing pending invites for this profile (acceptedOn is null = pending)
    db.query.profileInvites.findMany({
      where: {
        email: { in: normalizedEmails },
        profileId,
        acceptedOn: { isNull: true },
      },
    }),
    getProfileAccessUser({
      user,
      profileId,
    }),
    // Get the proposal with its decision profile for building the invite URL
    db.query.proposals.findFirst({
      where: { profileId },
      with: {
        processInstance: {
          with: { profile: true },
        },
      },
    }),
    // Check if this profile belongs directly to a process instance (decision-level invites)
    db.query.processInstances.findFirst({
      where: { profileId },
    }),
  ]);

  if (!profileUser) {
    throw new UnauthorizedError(
      'User must be associated with this profile to send invites',
    );
  }

  assertAccess(
    [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.INVITE_MEMBERS },
    ],
    profileUser.roles ?? [],
  );

  // Validate all roles exist
  const rolesById = new Map(targetRoles.map((r) => [r.id, r]));
  const invalidRoleIds = uniqueRoleIds.filter((id) => !rolesById.has(id));
  if (invalidRoleIds.length > 0) {
    throw new CommonError(
      `Invalid role(s) specified: ${invalidRoleIds.join(', ')}`,
    );
  }

  // Identify roles that include decisions: ADMIN — these bypass draft queueing
  const adminRoleIds = new Set(
    targetRoles
      .filter((role) =>
        role.zonePermissions.some(
          (zp) =>
            zp.accessZone.name === 'decisions' &&
            (zp.permission & permission.ADMIN) !== 0,
        ),
      )
      .map((role) => role.id),
  );

  const results = {
    successful: [] as string[],
    failed: [] as { email: string; reason: string }[],
    // Auth user IDs of existing users who were successfully invited (for cache invalidation)
    existingUserAuthIds: [] as string[],
  };

  // Compute repeated values once (same for every invitation)
  const inviterName = requesterProfile.name || user.email || 'A team member';
  const profileName = profile.name;
  const baseUrl = OPURLConfig('APP').ENV_URL;

  // Build the full invite URL for proposal profiles
  let inviteUrl = baseUrl;
  const decisionSlug = proposalWithDecision?.processInstance?.profile?.slug;
  if (profile.type === 'proposal' && decisionSlug) {
    inviteUrl = `${baseUrl}/decisions/${decisionSlug}/proposal/${profileId}/invite`;
  }

  const usersByEmail = new Map(
    existingUsers.map((user) => [user.email.toLowerCase(), user]),
  );

  const existingProfileUserAuthIds = new Set(
    existingUsers
      .filter((user) => user.profileUsers.length > 0)
      .map((user) => user.authUserId),
  );

  const allowListEmailsSet = new Set(
    existingAllowListEntries.map((entry) => entry.email.toLowerCase()),
  );

  const pendingInviteEmailsSet = new Set(
    existingPendingInvites.map((invite) => invite.email.toLowerCase()),
  );

  // Collect data for batch insert
  const allowListEntries: Array<{
    email: string;
    organizationId: null;
    metadata: null;
  }> = [];

  const profileInviteEntries: Array<{
    email: string;
    profileId: string;
    profileEntityType: string;
    accessRoleId: string;
    invitedBy: string;
    inviteeProfileId?: string;
    message?: string;
  }> = [];

  const emailsToInvite: Array<{
    email: string;
    authUserId?: string;
    inviterName: string;
    profileName: string;
    inviteUrl: string;
    personalMessage?: string;
  }> = [];

  // Process each invitation - validate and collect data
  for (const invitation of normalizedInvitations) {
    const { email, roleId } = invitation;
    const existingUser = usersByEmail.get(email);
    const targetRole = rolesById.get(roleId)!;

    // Check for pending invite (applies to both existing and new users)
    if (pendingInviteEmailsSet.has(email)) {
      results.failed.push({
        email,
        reason: 'User already has a pending invite to this profile',
      });
      continue;
    }

    // If existing user, check if already a member
    if (
      existingUser &&
      existingProfileUserAuthIds.has(existingUser.authUserId)
    ) {
      results.failed.push({
        email,
        reason: 'User is already a member of this profile',
      });
      continue;
    }

    // Collect allowList entry if needed (new user without existing allowList entry)
    if (!existingUser && !allowListEmailsSet.has(email)) {
      allowListEntries.push({
        email,
        organizationId: null,
        metadata: null,
      });
      // Mark as added to prevent duplicates within the same batch
      allowListEmailsSet.add(email);
    }

    // Collect profile invite entry
    profileInviteEntries.push({
      email,
      profileId,
      profileEntityType: profile.type,
      accessRoleId: targetRole.id,
      invitedBy: requesterProfileId,
      inviteeProfileId: existingUser?.profileId ?? undefined,
      message: personalMessage,
    });

    // Collect email data for event
    emailsToInvite.push({
      email,
      authUserId: existingUser?.authUserId,
      inviterName,
      profileName,
      inviteUrl,
      personalMessage,
    });
  }

  // Determine if emails should be sent immediately or queued.
  // Invites to draft processes are queued (notified=false) until publish,
  // UNLESS the role being assigned includes decisions: ADMIN.
  // Check both proposal-level (via proposal -> processInstance) and
  // decision-level (direct processInstance profile) relationships.
  const processInstanceStatus =
    proposalWithDecision?.processInstance?.status ??
    processInstanceForProfile?.status;
  const isDraft = processInstanceStatus === ProcessStatus.DRAFT;

  // Batch insert and send event in a single transaction
  // If event.send fails, we rollback the DB inserts
  if (profileInviteEntries.length > 0) {
    const inviteEntries = profileInviteEntries.map((entry) => ({
      ...entry,
      notified: !isDraft || adminRoleIds.has(entry.accessRoleId),
    }));

    await db.transaction(async (tx) => {
      if (allowListEntries.length > 0) {
        await tx.insert(allowList).values(allowListEntries);
      }
      const insertedInvites = await tx
        .insert(profileInvites)
        .values(inviteEntries)
        .returning({ id: profileInvites.id });

      // Send email events only for invites marked as notified
      const notifiedIndices = inviteEntries
        .map((entry, idx) => (entry.notified ? idx : -1))
        .filter((idx) => idx !== -1);

      if (notifiedIndices.length > 0) {
        await event.send({
          name: Events.profileInviteSent.name,
          data: {
            senderProfileId: requesterProfileId,
            inviteIds: notifiedIndices.map((idx) => insertedInvites[idx]!.id),
            invitations: notifiedIndices.map((idx) => emailsToInvite[idx]!),
          },
        });
      }
    });

    // Mark all as successful since transaction completed
    results.successful.push(...emailsToInvite.map((e) => e.email));
    // Collect auth user IDs for existing users (for cache invalidation)
    results.existingUserAuthIds.push(
      ...emailsToInvite
        .filter((e): e is typeof e & { authUserId: string } => !!e.authUserId)
        .map((e) => e.authUserId),
    );
  }

  const message = generateInviteResultMessage(
    results.successful.length,
    normalizedInvitations.length,
  );

  return {
    success: results.successful.length > 0,
    message,
    details: {
      successful: results.successful,
      failed: results.failed,
      existingUserAuthIds: results.existingUserAuthIds,
    },
  };
};
