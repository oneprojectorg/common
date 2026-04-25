import { db } from '@op/db/client';
import type { GetOrganizationPostsInput } from '@op/types';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

interface GetOrganizationPostsServiceInput extends GetOrganizationPostsInput {
  authUserId: string;
}

export const getOrganizationPosts = async (
  input: GetOrganizationPostsServiceInput,
) => {
  const {
    organizationId,
    parentPostId,
    limit = 20,
    offset = 0,
    includeChildren = false,
    authUserId,
  } = input;
  let { maxDepth = 3 } = input;

  // enforcing a max depth to prevent infinite cycles
  if (maxDepth > 2) {
    maxDepth = 2;
  }

  try {
    // Filter by parent post: null = top-level only, set = comments under that
    // parent, undefined = all regardless of parent.
    const postWhere =
      parentPostId === null
        ? { parentPostId: { isNull: true as const } }
        : parentPostId
          ? { parentPostId }
          : undefined;

    // Organization posts are filtered through postsToOrganizations
    const orgPosts = await db.query.postsToOrganizations.findMany({
      where: { organizationId },
      with: {
        post: {
          ...(postWhere && { where: postWhere }),
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
        },
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
      limit,
      offset,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    // Transform to match expected format and add reaction data
    const actorProfileId = await getCurrentProfileId(authUserId);
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items: orgPosts,
        profileId: actorProfileId,
      });

    return itemsWithReactionsAndComments;
  } catch (error) {
    console.error('Error fetching organization posts:', error);
    throw error;
  }
};
