import { db } from '@op/db/client';
import { posts, postsToOrganizations } from '@op/db/schema';
import type { GetOrganizationPostsInput } from '@op/types';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

interface GetOrganizationPostsServiceInput extends GetOrganizationPostsInput {
  authUserId: string;
}

export const getOrganizationPosts = async (input: GetOrganizationPostsServiceInput) => {
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
    // Build where conditions
    const conditions = [];

    // Filter by parent post
    if (parentPostId === null) {
      // Top-level posts only (no parent) - these are "posts"
      conditions.push(isNull(posts.parentPostId));
    } else if (parentPostId) {
      // Children of specific parent - these are "comments"
      conditions.push(eq(posts.parentPostId, parentPostId));
    }
    // If parentPostId is undefined, we get all posts regardless of parent

    // Organization posts are filtered through postsToOrganizations
    const orgPosts = await db.query.postsToOrganizations.findMany({
      where: eq(postsToOrganizations.organizationId, organizationId),
      with: {
        post: {
          where: conditions.length > 0 ? and(...conditions) : undefined,
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
      orderBy: [desc(postsToOrganizations.createdAt)],
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