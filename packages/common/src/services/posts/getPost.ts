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

  const post = await db.query.posts.findFirst({
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
  });

  if (!post) {
    return null;
  }

  // Prefer the pinned rootProfileId gate when present. Legacy posts written
  // before the gate was added fall back to the postsToProfiles index — those
  // rows still carry their original associations, so this preserves access
  // for the pre-migration corpus until a backfill lands.
  const profileIdsToAuthorize = post.rootProfileId
    ? [post.rootProfileId]
    : (
        await db
          .select({ profileId: postsToProfiles.profileId })
          .from(postsToProfiles)
          .where(eq(postsToProfiles.postId, postId))
      ).map((a) => a.profileId);

  const actorProfileId = await getCurrentProfileId(authUserId);

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: profileIdsToAuthorize,
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
