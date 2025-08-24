import { db } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export interface GetPostsInput {
  profileId?: string;
  parentPostId?: string | null; // null for top-level posts, string for child posts, undefined for all
  limit?: number;
  offset?: number;
  includeChildren?: boolean;
  maxDepth?: number;
  authUserId?: string; // Optional during migration, will be required later
}

export const getPosts = async (input: GetPostsInput) => {
  const {
    profileId,
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
    // This endpoint is for profile-based posts only
    if (!profileId) {
      return []; // Return empty array if no profileId provided
    }

    // Build where conditions for posts within the profile
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

    // Filter by profile through postsToProfiles
    const profilePosts = await db.query.postsToProfiles.findMany({
      where: eq(postsToProfiles.profileId, profileId),
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
      },
      limit,
      offset,
      orderBy: [desc(postsToProfiles.createdAt)],
    });

    // Transform to match expected format and add reaction data
    const actorProfileId = await getCurrentProfileId(authUserId);
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items: profilePosts.map((item: any) => ({ post: item.post })),
        profileId: actorProfileId,
      });

    return itemsWithReactionsAndComments.map((item) => item.post);
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};
