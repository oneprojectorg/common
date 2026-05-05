import { db } from '@op/db/client';
import { EntityType, postsToProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
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

  if (maxDepth > 2) {
    maxDepth = 2;
  }

  const [post, actorProfileId, associations] = await Promise.all([
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
                orderBy: { createdAt: 'desc' as const },
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
    db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, postId)),
  ]);

  if (!post) {
    return null;
  }

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: associations.map((a) => a.profileId),
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  const itemsWithReactionsAndComments = await getItemsWithReactionsAndComments({
    items: [{ post }],
    profileId: actorProfileId,
  });

  return itemsWithReactionsAndComments[0]?.post ?? null;
};
