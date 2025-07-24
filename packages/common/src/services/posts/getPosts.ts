import { db } from '@op/db/client';
import { posts, postsToOrganizations } from '@op/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export interface GetPostsInput {
  organizationId?: string;
  parentPostId?: string | null; // null for top-level posts, string for child posts, undefined for all
  limit?: number;
  offset?: number;
  includeChildren?: boolean;
  maxDepth?: number;
}

export const getPosts = async (input: GetPostsInput) => {
  const {
    organizationId,
    parentPostId,
    limit = 20,
    offset = 0,
    includeChildren = false,
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

    // Build the query with relations
    const query = db.query.posts.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit,
      offset,
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
        reactions: true,
        // Recursively include child posts if requested
        ...(includeChildren && maxDepth > 0
          ? {
              childPosts: {
                limit: 50, // Reasonable limit for child posts
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
                  reactions: true,
                  // One level of nesting for now (can be expanded recursively)
                  ...(maxDepth > 1
                    ? {
                        childPosts: {
                          limit: 20,
                          orderBy: [desc(posts.createdAt)],
                          with: {
                            profile: {
                              with: {
                                avatarImage: true,
                              },
                            },
                            reactions: true,
                          },
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
    });

    // If filtering by organization, we need to join through postsToOrganizations
    if (organizationId) {
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
              reactions: true,
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
                        reactions: true,
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
      const actorProfileId = await getCurrentProfileId();
      const itemsWithReactionsAndComments =
        await getItemsWithReactionsAndComments({
          items: orgPosts,
          profileId: actorProfileId,
        });

      return itemsWithReactionsAndComments;
    }

    // Execute query for non-organization posts
    const result = await query;

    // Add reaction counts and user reactions
    const actorProfileId = await getCurrentProfileId();
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items: result.map((post) => ({ post })),
        profileId: actorProfileId,
      });

    return itemsWithReactionsAndComments.map((item) => item.post);
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};
