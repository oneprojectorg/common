import { and, db, eq, exists, isNull } from '@op/db/client';
import { posts } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';

import {
  getCurrentProfileId,
  getItemsWithReactionsAndComments,
  getRelatedOrganizations,
} from '../';
import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';

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
  const { limit = 20, cursor } = options;

  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

  // Fetch posts for all organizations with pagination
  const [result, profileId] = await Promise.all([
    db.query.postsToOrganizations.findMany({
      where: {
        RAW: (table) => {
          // Filter to only include top-level posts (no parentPostId)
          const topLevelPostFilter = exists(
            db
              .select({ id: posts.id })
              .from(posts)
              .where(
                and(eq(posts.id, table.postId), isNull(posts.parentPostId)),
              ),
          );

          if (!decodedCursor) {
            return topLevelPostFilter;
          }

          const cursorCondition = getGenericCursorCondition({
            columns: { id: table.postId, date: table.createdAt },
            cursor: decodedCursor,
          });
          return and(cursorCondition, topLevelPostFilter)!;
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
      orderBy: (table, { desc }) => desc(table.createdAt),
      limit: limit + 1, // Fetch one extra to check hasMore
    }),
    getCurrentProfileId(authUserId),
  ]);

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

  const itemsWithReactionsAndComments = await getItemsWithReactionsAndComments({
    items,
    profileId,
  });

  return { items: itemsWithReactionsAndComments, next: nextCursor };
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

  // Fetch posts for all related organizations
  const result = await db.query.postsToOrganizations.findMany({
    where: {
      organizationId: { in: orgIds },
      RAW: (table) =>
        exists(
          db
            .select({ id: posts.id })
            .from(posts)
            .where(and(eq(posts.id, table.postId), isNull(posts.parentPostId))),
        ),
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
    orderBy: (table, { desc }) => desc(table.createdAt),
  });

  return result;
};
