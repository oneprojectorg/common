import { db } from '@op/db/client';

import { NotFoundError } from '../../utils/error';

/** One user with auth identity, profile and memberships. Uncached: admins need a fresh read. */
export const getUser = async ({ authUserId }: { authUserId: string }) => {
  const user = await db.query.users.findFirst({
    where: { authUserId },
    with: {
      authUser: true,
      avatarImage: true,
      profile: {
        with: {
          avatarImage: true,
        },
      },
      organizationUsers: {
        with: {
          organization: {
            with: {
              profile: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      },
      profileUsers: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User', authUserId);
  }

  return user;
};
