import { UnauthorizedError, getUserWithProfiles } from '@op/common';
import { EntityType, ObjectsInStorage, Profile } from '@op/db/schema';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/profiles`,
    protect: true,
    tags: ['account'],
    summary: 'Get user available profiles',
  },
};

export const userProfileSchema = z.object({
  id: z.string(),
  type: z.enum([EntityType.INDIVIDUAL, EntityType.ORG]),
  name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
  avatarImage: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
});

export const getUserProfiles = router({
  getUserProfiles: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(z.undefined())
    .output(
      z.array(
        userProfileSchema.extend({
          avatarImage: z
            .object({
              id: z.string(),
              name: z.string().nullable(),
            })
            .nullable(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const { id: authUserId } = ctx.user;

      // Get the user's database record with roles to filter for admin organizations
      const user = await getUserWithProfiles({
        authUserId,
        includeRoles: true,
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const userProfiles: Array<{
        id: string;
        type: EntityType.INDIVIDUAL | EntityType.ORG;
        name: string;
        slug: string;
        bio: string | null;
        avatarImage: { id: string; name: string | null } | null;
      }> = [];

      // Add user's personal profile if it exists
      if (user.profile) {
        const profile = user.profile as Profile & {
          avatarImage: ObjectsInStorage;
        };
        userProfiles.push({
          id: profile.id,
          type: EntityType.INDIVIDUAL,
          name: profile.name,
          slug: profile.slug,
          bio: profile.bio,
          avatarImage: profile.avatarImage
            ? {
                id: profile.avatarImage.id,
                name: profile.avatarImage.name,
              }
            : null,
        });
      }

      // Add organization profiles - only those where user has admin role
      for (const orgUser of user.organizationUsers) {
        if (orgUser.organization?.profile) {
          // Check if user has admin role in this organization
          const hasAdminRole = orgUser.roles?.some(
            (roleJunction: any) =>
              roleJunction.accessRole?.name?.toLowerCase() === 'admin',
          );

          if (hasAdminRole) {
            const profile = orgUser.organization.profile as any;
            userProfiles.push({
              id: profile.id,
              type: EntityType.ORG as const,
              name: profile.name,
              slug: profile.slug,
              bio: profile.bio,
              avatarImage: profile.avatarImage
                ? {
                    id: profile.avatarImage.id,
                    name: profile.avatarImage.name,
                  }
                : null,
            });
          }
        }
      }

      return userProfiles;
    }),
});
