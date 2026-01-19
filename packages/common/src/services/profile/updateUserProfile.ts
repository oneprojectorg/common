import { db, eq } from '@op/db/client';
import {
  EntityType,
  individuals,
  individualsTerms,
  profiles,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { generateUniqueProfileSlug } from './utils';

export interface UpdateUserProfileInput {
  name?: string;
  bio?: string;
  title?: string;
  pronouns?: string;
  username?: string;
  email?: string;
  website?: string;
  focusAreas?: Array<{ id: string; label: string }>;
}

export interface UpdateUserProfileParams {
  input: UpdateUserProfileInput;
  user: User;
  db?: typeof db; // Make db optional since we can use the imported client
}

export const updateUserProfile = async ({
  input,
  user,
  db: dbClient = db, // Use provided db or fall back to imported client
}: UpdateUserProfileParams) => {
  const { name, bio, title, pronouns, username, email, website, focusAreas } =
    input;

  // Get the current user to check if they have a profile
  const currentUser = await dbClient._query.users.findFirst({
    where: eq(users.authUserId, user.id),
    with: {
      profile: true,
    },
  });

  if (!currentUser) {
    throw new Error('User not found');
  }

  // Prepare profile data
  const profileData: any = {};
  if (name !== undefined) profileData.name = name;
  if (bio !== undefined) profileData.bio = bio;
  if (email !== undefined) profileData.email = email;
  if (website !== undefined) profileData.website = website;

  // Prepare user data (username and title stay in users table)
  const userData: any = {};
  if (username !== undefined) userData.username = username;
  if (title !== undefined) userData.title = title;

  // Check if user already has a profile
  if (currentUser.profile && 'id' in currentUser.profile) {
    // Update existing profile
    if (Object.keys(profileData).length > 0) {
      await dbClient
        .update(profiles)
        .set(profileData)
        .where(eq(profiles.id, currentUser.profile.id));
    }
  } else {
    // Create new profile for user
    if (Object.keys(profileData).length > 0) {
      const slug = await generateUniqueProfileSlug({
        name: name || currentUser.name || 'Unnamed User',
      });

      const [newProfile] = await dbClient
        .insert(profiles)
        .values({
          type: EntityType.INDIVIDUAL,
          name: name || currentUser.name || 'Unnamed User',
          slug,
          bio,
          email,
          website,
        })
        .returning();

      if (!newProfile) {
        throw new Error('Failed to create profile');
      }

      // Update user's profileId and currentProfileId to point to the new profile
      await dbClient
        .update(users)
        .set({ currentProfileId: newProfile.id, profileId: newProfile.id })
        .where(eq(users.authUserId, user.id));
    }
  }

  // Update user table fields (username, title)
  if (Object.keys(userData).length > 0) {
    await dbClient
      .update(users)
      .set(userData)
      .where(eq(users.authUserId, user.id));
  }

  // Handle focus areas and pronouns if provided
  if (focusAreas !== undefined || pronouns !== undefined) {
    // TODO: optimize this
    // First, ensure the user has an individual record
    const updatedCurrentUser = await dbClient._query.users.findFirst({
      where: eq(users.authUserId, user.id),
      with: {
        profile: true,
      },
    });

    if (updatedCurrentUser?.profile) {
      // Check if individual record exists
      let individualRecord = await dbClient._query.individuals.findFirst({
        where: eq(
          individuals.profileId,
          (updatedCurrentUser.profile as any).id,
        ),
      });

      // Create individual record if it doesn't exist
      if (!individualRecord) {
        const [newIndividual] = await dbClient
          .insert(individuals)
          .values({
            profileId: (updatedCurrentUser.profile as any).id,
          })
          .returning();

        if (newIndividual) {
          individualRecord = newIndividual;
        }
      }

      if (individualRecord) {
        // Update focus areas in transaction
        await dbClient.transaction(async (tx) => {
          // Remove existing focus areas
          await tx
            .delete(individualsTerms)
            .where(eq(individualsTerms.individualId, individualRecord.id));

          // Add new focus areas
          if (focusAreas && focusAreas.length > 0) {
            await Promise.all(
              focusAreas.map((term) =>
                tx
                  .insert(individualsTerms)
                  .values({
                    individualId: individualRecord.id,
                    taxonomyTermId: term.id,
                  })
                  .onConflictDoNothing(),
              ),
            );
          }
        });

        // Add pronouns
        if (pronouns !== undefined) {
          await dbClient
            .update(individuals)
            .set({ pronouns: pronouns || null })
            .where(eq(individuals.id, individualRecord.id));
        }
      }
    }
  }

  // Return the updated user with all relations
  const updatedUser = await dbClient._query.users.findFirst({
    where: eq(users.authUserId, user.id),
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
        },
      },
      profile: {
        with: {
          avatarImage: true,
          individual: { columns: { pronouns: true } },
        },
      },
    },
  });

  if (!updatedUser) {
    throw new Error('User not found after update');
  }

  return updatedUser;
};
