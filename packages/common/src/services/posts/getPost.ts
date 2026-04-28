import { db } from '@op/db/client';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export const getPost = async ({
  postId,
  includeChildren = false,
  authUserId,
  ...input
}: {
  postId: string;
  includeChildren?: boolean;
  maxDepth?: number;
  authUserId: string;
}) => {
  let { maxDepth = 2 } = input;

  // enforcing a max depth to prevent infinite cycles
  if (maxDepth > 2) {
    maxDepth = 2;
  }

  try {
    // Query post directly by ID
    const [post, actorProfileId] = await Promise.all([
      db.query.posts.findFirst({
        where: { id: postId },
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
                  orderBy: (table, { desc }) => [desc(table.createdAt)],
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
      }),
      getCurrentProfileId(authUserId),
    ]);

    if (!post) {
      return null;
    }

    // Transform to add reaction data
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
