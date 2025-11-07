import { db } from '@op/db/client';
import { posts } from '@op/db/schema';
import { desc, eq } from 'drizzle-orm';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export interface GetPostInput {
  postId: string;
  includeChildren?: boolean;
  maxDepth?: number;
  authUserId: string;
}

export const getPost = async (input: GetPostInput) => {
  const { postId, includeChildren = false, authUserId } = input;
  let { maxDepth = 2 } = input;

  // enforcing a max depth to prevent infinite cycles
  if (maxDepth > 2) {
    maxDepth = 2;
  }

  try {
    // Query post directly by ID
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
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
        ...(includeChildren && maxDepth > 0
          ? {
              childPosts: {
                limit: 50,
                orderBy: [desc(posts.createdAt)],
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
                },
              },
            }
          : {}),
      },
    });

    if (!post) {
      return null;
    }

    // Transform to add reaction data
    const actorProfileId = await getCurrentProfileId(authUserId);
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items: [{ post }],
        profileId: actorProfileId,
      });

    return itemsWithReactionsAndComments[0]?.post || null;
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};
