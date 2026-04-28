import { db } from '@op/db/client';

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
    const profilePosts = await db.query.postsToProfiles.findMany({
      where: { profileId: input.profileId },
      with: {
        post: {
          where: { parentPostId: { isNull: true } }, // Only top-level posts
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
              orderBy: (table, { desc }) => [desc(table.createdAt)],
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
      orderBy: (table, { desc }) => [desc(table.createdAt)],
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
