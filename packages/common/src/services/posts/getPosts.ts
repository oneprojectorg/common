import { db } from '@op/db/client';
import { EntityType, postsToProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export interface GetPostsInput {
  profileId?: string;
  parentPostId?: string | null; // null for top-level posts, string for child posts
  limit?: number;
  offset?: number;
  includeChildren?: boolean;
  maxDepth?: number;
  authUserId: string;
}

const postRelations = {
  profile: { with: { avatarImage: true } },
  attachments: { with: { storageObject: true } },
  reactions: { with: { profile: true } },
} as const;

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

  if (maxDepth > 2) {
    maxDepth = 2;
  }

  if (!profileId && !parentPostId) {
    return [];
  }

  // When scoping by profile without an explicit parentPostId, default to
  // top-level posts. Comments inherit their parent's profile associations,
  // so without this filter a profile feed would surface comments alongside
  // updates and silently mix authorization contexts.
  const effectiveParentPostId =
    profileId && parentPostId === undefined ? null : parentPostId;

  const profileIdsToAuthorize = profileId
    ? [profileId]
    : parentPostId
      ? (
          await db
            .select({ profileId: postsToProfiles.profileId })
            .from(postsToProfiles)
            .where(eq(postsToProfiles.postId, parentPostId))
        ).map((p) => p.profileId)
      : [];

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: profileIdsToAuthorize,
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  const postWhere =
    effectiveParentPostId === null
      ? ({ parentPostId: { isNull: true } } as const)
      : effectiveParentPostId
        ? { parentPostId: effectiveParentPostId }
        : undefined;

  const childPostsRelation =
    includeChildren && maxDepth > 0
      ? {
          childPosts: {
            limit: 50,
            orderBy: { createdAt: 'desc' as const },
            with: postRelations,
          },
        }
      : {};

  const postWith = { ...postRelations, ...childPostsRelation };

  const postsData = profileId
    ? await db.query.postsToProfiles.findMany({
        where: { profileId },
        with: {
          post: {
            where: postWhere,
            with: postWith,
          },
        },
        limit,
        offset,
        orderBy: { createdAt: 'desc' as const },
      })
    : (
        await db.query.posts.findMany({
          where: postWhere,
          with: postWith,
          limit,
          offset,
          orderBy: { createdAt: 'desc' as const },
        })
      ).map((post) => ({ post }));

  const actorProfileId = await getCurrentProfileId(authUserId);
  const itemsWithReactionsAndComments = await getItemsWithReactionsAndComments({
    items: postsData.map((item) => ({ post: item.post })),
    profileId: actorProfileId,
  });

  return itemsWithReactionsAndComments.map((item) => item.post);
};
