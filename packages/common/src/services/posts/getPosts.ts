import { db } from '@op/db/client';
import {
  EntityType,
  posts as postsTable,
  postsToProfiles,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, desc, eq, isNull } from 'drizzle-orm';

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

  const postRelations = {
    profile: { with: { avatarImage: true } },
    attachments: { with: { storageObject: true } },
    reactions: { with: { profile: true } },
  } as const;

  // When scoping by profile without an explicit parentPostId, default to
  // top-level posts. Comments inherit their parent's profile associations,
  // so without this filter a profile feed would surface comments alongside
  // updates and silently mix authorization contexts.
  const effectiveParentPostId =
    profileId && parentPostId === undefined ? null : parentPostId;

  // Prefer the parent's pinned rootProfileId gate when present. Legacy posts
  // written before the gate was added fall back to postsToProfiles so the
  // pre-migration corpus keeps working until a backfill lands.
  const profileIdsToAuthorize = profileId
    ? [profileId]
    : parentPostId
      ? await (async () => {
          const [parent] = await db
            .select({ rootProfileId: postsTable.rootProfileId })
            .from(postsTable)
            .where(eq(postsTable.id, parentPostId))
            .limit(1);

          if (parent?.rootProfileId) {
            return [parent.rootProfileId];
          }

          const rows = await db
            .select({ profileId: postsToProfiles.profileId })
            .from(postsToProfiles)
            .where(eq(postsToProfiles.postId, parentPostId));
          return rows.map((p) => p.profileId);
        })()
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

  // Filter at the SQL level so pagination doesn't under-fetch when comments
  // inherit profile associations from their parent. A relational
  // `where: { post: { parentPostId: ... } }` produces a LEFT JOIN that returns
  // nulls for filtered rows — paginating on those rows silently drops pages.
  const parentPostCondition =
    effectiveParentPostId === null
      ? isNull(postsTable.parentPostId)
      : effectiveParentPostId
        ? eq(postsTable.parentPostId, effectiveParentPostId)
        : undefined;

  const postsData = profileId
    ? await (async () => {
        const pageRows = await db
          .select({ postId: postsToProfiles.postId })
          .from(postsToProfiles)
          .innerJoin(
            postsTable,
            parentPostCondition
              ? and(
                  eq(postsTable.id, postsToProfiles.postId),
                  parentPostCondition,
                )
              : eq(postsTable.id, postsToProfiles.postId),
          )
          .where(eq(postsToProfiles.profileId, profileId))
          .orderBy(
            desc(postsToProfiles.createdAt),
            desc(postsToProfiles.postId),
          )
          .limit(limit)
          .offset(offset);

        const postIds = pageRows.map((row) => row.postId);
        if (postIds.length === 0) {
          return [];
        }

        const hydrated = await db.query.posts.findMany({
          where: { id: { in: postIds } },
          with: postWith,
        });

        const postById = new Map(hydrated.map((post) => [post.id, post]));
        return postIds
          .map((id) => postById.get(id))
          .filter(
            (post): post is NonNullable<typeof post> => post !== undefined,
          )
          .map((post) => ({ post }));
      })()
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
