import { CommonError, NotFoundError } from '@op/common';
import { type db as Database, eq } from '@op/db/client';
import { EntityType, individuals, profiles, users } from '@op/db/schema';
import { randomUUID } from 'crypto';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { CommonUser, userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

// Helper function to ensure user has a profile and individual record
const ensureProfileAndIndividual = async (
  db: typeof Database,
  user: CommonUser,
) => {
  let profileId = user.profileId;

  // Create profile if it doesn't exist and migrate properties
  if (!profileId) {
    await db.transaction(async (tx) => {
      const slug = randomUUID();

      const [newProfile] = await tx
        .insert(profiles)
        .values({
          type: EntityType.INDIVIDUAL,
          name: user.name || 
                (user.email ? user.email.split('@')[0] : null) || 
                'Unnamed User',
          slug,
          email: user.email,
          avatarImageId: user.avatarImageId,
          bio: user.title,
        })
        .returning();

      if (!newProfile) {
        throw new CommonError('Failed to create profile');
      }

      // Update user's profileId
      await tx
        .update(users)
        .set({ profileId: newProfile.id })
        .where(eq(users.authUserId, user.authUserId));

      profileId = newProfile.id;

      // Update the user object to reflect the new profile
      user.profile = newProfile;
      user.profileId = newProfile.id;
    });
  }

  // Check if individual record exists
  const individualRecord = await db.query.individuals.findFirst({
    where: eq(individuals.profileId, profileId!),
  });

  // Create individual record if it doesn't exist
  if (!individualRecord && profileId) {
    await db
      .insert(individuals)
      .values({
        profileId: profileId,
      })
      .onConflictDoNothing();
  }

  return user;
};

// Reusable function for user query with all relations
const getUserWithRelations = async (
  db: typeof Database, 
  condition: (table: any, ops: any) => any
) => {
  return await db.query.users.findFirst({
    where: condition,
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
      profile: {
        with: {
          avatarImage: true,
          headerImage: true,
        },
      },
    },
  });
};

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

      const result = await getUserWithRelations(
        db,
        (table, { eq }) => eq(table.authUserId, id)
      );

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

        const newUserWithRelations = await getUserWithRelations(
          db,
          (table, { eq }) => eq(table.id, newUser.id)
        );

        const profileUser = await ensureProfileAndIndividual(
          db,
          newUserWithRelations as CommonUser,
        );

        return userEncoder.parse(profileUser);
      }

      const profileUser = await ensureProfileAndIndividual(
        db,
        result as CommonUser,
      );

      return userEncoder.parse(profileUser);
    }),
});
