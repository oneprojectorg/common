import { and, db, eq, exists, inArray, isNull } from '@op/db/client';
import { posts } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  getCurrentProfileId,
  getItemsWithLikesAndComments,
  getRelatedOrganizations,
} from '../';
import {
  PAGE_LIMIT,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { postModerationFilter } from './listPosts';

// Cross-org aggregate feeds hide flagged posts from general readers but keep
// them visible to their author. Admin visibility lives in the per-org and
// per-profile views (listPosts/getPosts), which resolve a single governing
// profile to check; an aggregate feed spans many orgs with no single governing
// profile, so it filters on author identity alone (no admin exception).

export interface ListAllPostsOptions {
  limit?: number;
  cursor?: string | null;
}

export interface ListRelatedPostsOptions {
  organizationId: string;
  user: User;
}

export const listAllRelatedOrganizationPosts = async (
  authUserId: string,
  options: ListAllPostsOptions = {},
) => {
  const { limit = PAGE_LIMIT.md, cursor } = options;

  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

  // Resolve the reader's profile first so the moderation filter (author
  // exception) can run inside the SQL where clause below.
  const profileId = await getCurrentProfileId(authUserId);

  // Fetch posts for all organizations with pagination
  const result = await db.query.postsToOrganizations.findMany({
    where: {
      // The RAW callback's `table` is the aliased base table that the v2
      // relational query uses in the generated FROM clause. Building the
      // cursor condition from the un-aliased schema reference makes Postgres
      // error with "invalid reference to FROM-clause entry", failing every
      // page request past the first and keeping the infinite-scroll trigger
      // in retry-storm.
      RAW: (table) => {
        const cursorCondition = decodedCursor
          ? getGenericCursorCondition({
              columns: { id: table.postId, date: table.createdAt },
              cursor: decodedCursor,
            })
          : undefined;

        // Filter to top-level posts (no parentPostId) the reader may see —
        // flagged posts drop out unless the reader authored them.
        const topLevelPostFilter = exists(
          db
            .select({ id: posts.id })
            .from(posts)
            .where(
              and(
                eq(posts.id, table.postId),
                isNull(posts.parentPostId),
                postModerationFilter(posts, profileId),
              ),
            ),
        );

        return cursorCondition
          ? and(cursorCondition, topLevelPostFilter)!
          : topLevelPostFilter;
      },
    },
    with: {
      post: {
        with: {
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
    orderBy: { createdAt: 'desc' as const },
    limit: limit + 1, // Fetch one extra to check hasMore
  });

  const hasMore = result.length > limit;
  const items = result.slice(0, limit);
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem && lastItem.createdAt
      ? encodeCursor({
          date: new Date(lastItem.createdAt),
          id: lastItem.postId,
        })
      : null;

  const itemsWithLikesAndComments = await getItemsWithLikesAndComments({
    items,
    profileId,
  });

  return { items: itemsWithLikesAndComments, next: nextCursor };
};

export const listRelatedOrganizationPosts = async (
  options: ListRelatedPostsOptions,
) => {
  const { organizationId, user } = options;

  // Get related organizations
  const { records: organizations } = await getRelatedOrganizations({
    user,
    orgId: organizationId,
    pending: false,
  });

  const orgIds = organizations?.map((org: any) => org.id) ?? [];
  orgIds.push(organizationId); // Add our own org so we see our own posts

  const actorProfileId = await getCurrentProfileId(user.id);

  // Fetch posts for all related organizations
  const result = await db.query.postsToOrganizations.findMany({
    where: {
      RAW: (table) => {
        // Filter to top-level posts (no parentPostId) the reader may see —
        // flagged posts drop out unless the reader authored them.
        const topLevelPostFilter = exists(
          db
            .select({ id: posts.id })
            .from(posts)
            .where(
              and(
                eq(posts.id, table.postId),
                isNull(posts.parentPostId),
                postModerationFilter(posts, actorProfileId),
              ),
            ),
        );

        return and(inArray(table.organizationId, orgIds), topLevelPostFilter)!;
      },
    },
    with: {
      post: {
        with: {
          attachments: {
            with: {
              storageObject: true,
            },
          },
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
    orderBy: { createdAt: 'desc' as const },
  });

  return result;
};
