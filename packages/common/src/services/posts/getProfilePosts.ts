import { db, eq } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
import { desc, isNull } from 'drizzle-orm';

export interface GetProfilePostsInput {
  profileId: string;
  limit?: number;
  offset?: number;
}

export const getProfilePosts = async (input: GetProfilePostsInput) => {
  const limit = input.limit || 20;
  const offset = input.offset || 0;

  try {
    // Get posts attached to this profile via postsToProfiles junction table
    const profilePosts = await db._query.postsToProfiles.findMany({
      where: eq(postsToProfiles.profileId, input.profileId),
      with: {
        post: {
          where: isNull(posts.parentPostId), // Only top-level posts
          with: {
            profile: {
              with: {
                avatarImage: true,
              },
            },
            attachments: {
              with: {
                storageObject: true,
              },
            },
            reactions: {
              with: {
                profile: true,
              },
            },
            childPosts: {
              limit: 50,
              orderBy: [desc(posts.createdAt)],
              with: {
                profile: {
                  with: {
                    avatarImage: true,
                  },
                },
                reactions: {
                  with: {
                    profile: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [desc(postsToProfiles.createdAt)],
      limit,
      offset,
    });

    // Filter out any items where post is null (due to parentPostId filtering)
    const filteredResult = profilePosts.filter((item) => item.post !== null);

    return filteredResult.map((item) => item.post);
  } catch (error) {
    console.error('Error fetching profile posts:', error);
    throw error;
  }
};
