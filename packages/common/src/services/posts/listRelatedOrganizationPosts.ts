import { db, inArray } from '@op/db/client';
import { postsToOrganizations } from '@op/db/schema';
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

  // Build cursor condition for pagination
  const cursorCondition = cursor
    ? getGenericCursorCondition({
        columns: {
          id: postsToOrganizations.postId,
          date: postsToOrganizations.createdAt,
        },
        cursor: decodeCursor(cursor),
      })
    : undefined;

  // Fetch posts for all organizations with pagination
  const [result, profileId] = await Promise.all([
    db.query.postsToOrganizations.findMany({
      where: cursorCondition,
      with: {
        post: {
          where: (table, { isNull }) => isNull(table.parentPostId), // Only show top-level posts
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

  // Filter out any items where post is null (due to parentPostId filtering)
  const filteredResult = result.filter((item) => item.post !== null);

  const hasMore = filteredResult.length > limit;
  const items = hasMore ? filteredResult.slice(0, limit) : filteredResult;
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

  return {
    items: itemsWithReactionsAndComments,
    next: nextCursor,
    hasMore,
  };
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
    where: () => inArray(postsToOrganizations.organizationId, orgIds),
    with: {
      post: {
        where: (table, { isNull }) => isNull(table.parentPostId), // Only show top-level posts
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

  // Filter out any items where post is null (due to parentPostId filtering)
  const filteredResult = result.filter((item) => item.post !== null);

  return filteredResult;
};
