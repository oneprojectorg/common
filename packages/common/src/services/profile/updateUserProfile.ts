import { db, eq } from '@op/db/client';
import { users, profiles, EntityType } from '@op/db/schema';
import { randomUUID } from 'crypto';
import type { User } from '@op/supabase/lib';

export interface UpdateUserProfileInput {
  name?: string;
  about?: string;
  title?: string;
  username?: string;
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
  const { name, about, title, username } = input;

  // Get the current user to check if they have a profile
  const currentUser = await dbClient.query.users.findFirst({
    where: eq(users.authUserId, user.id),
    with: {
      currentProfile: true,
    },
  });

  if (!currentUser) {
    throw new Error('User not found');
  }

  // Prepare profile data
  const profileData: any = {};
  if (name !== undefined) profileData.name = name;
  if (about !== undefined) profileData.bio = about; // Map 'about' to 'bio' in profiles
  
  // Prepare user data (username and title stay in users table)
  const userData: any = {};
  if (username !== undefined) userData.username = username;
  if (title !== undefined) userData.title = title;

  // Check if user already has a profile
  if (currentUser.currentProfile && 'id' in currentUser.currentProfile) {
    // Update existing profile
    if (Object.keys(profileData).length > 0) {
      await dbClient
        .update(profiles)
        .set(profileData)
        .where(eq(profiles.id, currentUser.currentProfile.id));
    }
  } else {
    // Create new profile for user
    if (Object.keys(profileData).length > 0) {
      // For now, use UUID as slug (same as organization profiles)
      const slug = randomUUID();
      
      const [newProfile] = await dbClient
        .insert(profiles)
        .values({
          type: EntityType.USER,
          name: name || currentUser.name || 'Unnamed User',
          slug,
          bio: about,
        })
        .returning();

      if (!newProfile) {
        throw new Error('Failed to create profile');
      }

      // Update user's currentProfileId to point to the new profile
      await dbClient
        .update(users)
        .set({ currentProfileId: newProfile.id })
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

  // Return the updated user with all relations
  const updatedUser = await dbClient.query.users.findFirst({
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
    },
  });

  if (!updatedUser) {
    throw new Error('User not found after update');
  }

  return updatedUser;
};