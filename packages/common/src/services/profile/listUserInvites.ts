import { count, countDistinct, db, inArray } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

/**
 * List invites for the current user by email.
 * No special access check needed - user can only query their own email.
 */
export const listUserInvites = async ({
  user,
  entityType,
  pending,
}: {
  user: User;
  entityType?: string;
  pending?: boolean;
}) => {
  if (!user.email) {
    return [];
  }

  const invites = await db.query.profileInvites.findMany({
    where: {
      email: { ilike: user.email },
      ...(pending === true && { acceptedOn: { isNull: true } }),
      ...(pending === false && { acceptedOn: { isNotNull: true } }),
      ...(entityType && { profileEntityType: entityType }),
    },
    with: {
      accessRole: true,
      profile: {
        with: {
          avatarImage: true,
          processInstance: {
            with: {
              steward: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
        },
      },
      inviter: {
        with: {
          avatarImage: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Collect processInstance IDs and fetch proposal counts at the DB level
  const instanceIds = invites
    .map((i) => i.profile?.processInstance?.id)
    .filter((id): id is string => !!id);

  const countsMap = new Map<
    string,
    { proposalCount: number; participantCount: number }
  >();

  if (instanceIds.length > 0) {
    const counts = await db
      .select({
        processInstanceId: proposals.processInstanceId,
        proposalCount: count(proposals.id),
        participantCount: countDistinct(proposals.submittedByProfileId),
      })
      .from(proposals)
      .where(inArray(proposals.processInstanceId, instanceIds))
      .groupBy(proposals.processInstanceId);

    for (const row of counts) {
      countsMap.set(row.processInstanceId, {
        proposalCount: row.proposalCount,
        participantCount: row.participantCount,
      });
    }
  }

  return invites.map((invite) => {
    const instanceId = invite.profile?.processInstance?.id;
    const stats = instanceId ? countsMap.get(instanceId) : undefined;

    return {
      ...invite,
      proposalCount: stats?.proposalCount ?? 0,
      participantCount: stats?.participantCount ?? 0,
    };
  });
};

export type UserInvite = Awaited<ReturnType<typeof listUserInvites>>[number];
