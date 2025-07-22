import { CommonError, NotFoundError } from '@op/common';
import { users } from '@op/db/schema';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account`,
    protect: true,
    tags: ['account'],
    summary: 'Get user profile',
  },
};

export const getMyAccount = router({
  getMyAccount: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(z.undefined())
    .output(userEncoder)
    .query(async ({ ctx }) => {
      const { db } = ctx.database;
      const { id, email } = ctx.user;

      const result = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, id),
        with: {
          avatarImage: true,
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
            },
          },
          currentOrganization: {
            with: {
              profile: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
          currentProfile: {
            with: {
              avatarImage: true,
              headerImage: true,
            },
          },
        },
      });

      if (!result) {
        if (!email) {
          throw new NotFoundError('Could not find user');
        }

        // if there is no user but the user is authenticated, create one
        const [newUser] = await db
          .insert(users)
          .values({
            authUserId: id,
            email: ctx.user.email!,
          })
          .returning();

        if (!newUser) {
          throw new CommonError('Could not create user');
        }

        const newUserWithRelations = await db.query.users.findFirst({
          where: (table, { eq }) => eq(table.id, newUser.id),
          with: {
            avatarImage: true,
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
              },
            },
            currentOrganization: {
              with: {
                profile: {
                  with: {
                    avatarImage: true,
                  },
                },
              },
            },
            currentProfile: {
              with: {
                avatarImage: true,
                headerImage: true,
              },
            },
          },
        });

        return userEncoder.parse(newUserWithRelations);
      }

      return userEncoder.parse(result);
    }),
});
