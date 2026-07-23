import {
  and,
  count,
  db,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from '@op/db/client';
import {
  postReactions,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { logger } from '@op/logging';
import { checkPermission, permission } from 'access-zones';
import type { SQL } from 'drizzle-orm';

import {
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';
import {
  getActivelyFlaggedItemIds,
  noActiveModerationFlag,
} from '../moderation/moderationVisibility';

/**
 * SQL filter for post/comment reads: the row carries no active moderation flag,
 * or `actorProfileId` authored it. Pass the (possibly aliased) posts table the
 * surrounding query builds against. Admins skip moderation entirely, so callers
 * compose that exception themselves:
 * `isAdmin ? undefined : postModerationFilter(table, actorProfileId)`.
 */
export const postModerationFilter = (
  table: typeof posts,
  actorProfileId: string | undefined,
): SQL =>
  or(
    noActiveModerationFlag('post', table.id),
    actorProfileId ? eq(table.profileId, actorProfileId) : sql`false`,
  )!;

export const listPosts = async ({
  authUserId,
  slug,
  limit = 20,
  cursor,
}: {
  authUserId: string;
  slug: string;
  limit?: number;
  cursor?: string | null;
}) => {
  try {
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

    const profile = slug
      ? await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.slug, slug))
          .limit(1)
      : null;

    const profileId = profile?.[0]?.id;

    if (!profileId) {
      throw new NotFoundError('Organization', slug);
    }

    const org = await db.query.organizations.findFirst({
      where: { profileId },
    });

    if (!org) {
      logger.error('Could not find org while listing posts', {
        profileId,
        slug,
      });
      throw new NotFoundError('Organization', profileId);
    }

    // The caller's profile + org-admin standing drive the moderation filter:
    // flagged posts stay visible to their author and to admins of the org, and
    // are hidden from everyone else (filtered in SQL). Org-admin roles live on
    // `organizationUsers` (not `profileUsers`), so resolve them via
    // `getOrgAccessUser` — a `getProfileAccessUser` lookup on the org's profile
    // never sees them and would hide flagged posts from admins too.
    const [actorProfileId, orgUser] = await Promise.all([
      getCurrentProfileId(authUserId),
      getOrgAccessUser({ user: { id: authUserId }, organizationId: org.id }),
    ]);
    const isOrgAdmin = checkPermission(
      { profile: permission.ADMIN },
      orgUser?.roles ?? [],
    );

    // Page the post ids on the join itself (top-level + moderation filters on
    // the paginated root), so a flagged or comment row never occupies a page
    // slot or distorts hasMore/nextCursor. A nested relational `with` would
    // LEFT JOIN and null the relation while still consuming the slot — see
    // listProfilePosts for the same two-stage pattern.
    const moderationFilter = isOrgAdmin
      ? undefined
      : postModerationFilter(posts, actorProfileId);

    const pageRows = await db
      .select({
        postId: postsToOrganizations.postId,
        createdAt: postsToOrganizations.createdAt,
      })
      .from(postsToOrganizations)
      .innerJoin(
        posts,
        and(
          eq(posts.id, postsToOrganizations.postId),
          isNull(posts.parentPostId), // Only show top-level posts
          moderationFilter,
        ),
      )
      .where(
        cursorCondition
          ? and(
              eq(postsToOrganizations.organizationId, org.id),
              cursorCondition,
            )
          : eq(postsToOrganizations.organizationId, org.id),
      )
      .orderBy(
        desc(postsToOrganizations.createdAt),
        desc(postsToOrganizations.postId),
      )
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const pageItems = pageRows.slice(0, limit);
    const pageIds = pageItems.map((row) => row.postId);

    // Hydrate the paged ids (the moderation/top-level filtering already
    // happened above). Re-ordered to the page order below, since `inArray`
    // doesn't preserve it.
    const hydrated = pageIds.length
      ? await db.query.postsToOrganizations.findMany({
          where: {
            organizationId: org.id,
            postId: { in: pageIds },
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
        })
      : [];

    const byPostId = new Map(hydrated.map((row) => [row.postId, row]));
    const items = pageIds
      .map((id) => byPostId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null);

    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.createdAt
        ? encodeCursor({
            date: new Date(lastItem.createdAt),
            id: lastItem.postId,
          })
        : null;

    // Transform items to include reaction counts, user's reactions, and comment counts
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items,
        profileId: actorProfileId,
      });

    return { items: itemsWithReactionsAndComments, next: nextCursor };
  } catch (e) {
    logger.error('Error listing posts', { error: e });
    throw e;
  }
};

/**
 * How many reactor profiles we hydrate per (post, reactionType) for the UI
 * preview. The feed only ever renders the most-recent handful of reactor names
 * in a tooltip (the exact total comes from `reactionCounts`), so a windowed
 * top-N keeps a viral post from dragging every reactor's profile into the page.
 */
export const REACTION_PREVIEW_LIMIT = 3;

/**
 * Fields added to posts by this function
 */
type EnhancedPostFields = {
  reactionCounts: Record<string, number>;
  reactionUsers: Record<
    string,
    Array<{ id: string; name: string; timestamp: Date }>
  >;
  userReaction: string | null;
  commentCount: number;
  /** True when an active moderation flag hides this post from general readers.
   *  Only the author and admins ever receive a flagged post (the read filters
   *  exclude it for everyone else), so this drives their "Flagged" indicator. */
  isFlagged: boolean;
};

type ReactionEnrichment = {
  reactionCounts: Record<string, number>;
  reactionUsers: Record<
    string,
    Array<{ id: string; name: string; timestamp: Date }>
  >;
  userReaction: string | null;
};

const emptyReactionEnrichment = (): ReactionEnrichment => ({
  reactionCounts: {},
  reactionUsers: {},
  userReaction: null,
});

/**
 * Derives reaction counts, a windowed top-N reactor preview, and the caller's
 * own reaction for a set of posts — entirely in SQL. Replaces hydrating every
 * reactor's profile per reaction (which made feeds scale with total reactions,
 * not page size).
 */
const getReactionEnrichmentByPostId = async ({
  postIds,
  profileId,
}: {
  postIds: string[];
  profileId?: string;
}): Promise<Map<string, ReactionEnrichment>> => {
  const enrichment = new Map<string, ReactionEnrichment>();
  postIds.forEach((id) => {
    enrichment.set(id, emptyReactionEnrichment());
  });

  if (postIds.length === 0) {
    return enrichment;
  }

  // (b) Windowed top-N reactor preview per (post, reactionType), most recent
  // first, in a single round-trip via ROW_NUMBER().
  const ranked = db
    .select({
      postId: postReactions.postId,
      reactionType: postReactions.reactionType,
      profileId: postReactions.profileId,
      name: profiles.name,
      createdAt: postReactions.createdAt,
      rowNumber: sql<number>`row_number() over (
        partition by ${postReactions.postId}, ${postReactions.reactionType}
        order by ${postReactions.createdAt} desc, ${postReactions.id} desc
      )`.as('row_number'),
    })
    .from(postReactions)
    .innerJoin(profiles, eq(profiles.id, postReactions.profileId))
    .where(inArray(postReactions.postId, postIds))
    .as('ranked');

  // The three reads are independent — run them concurrently.
  const [counts, previews, own] = await Promise.all([
    // (a) Exact totals per (post, reactionType).
    db
      .select({
        postId: postReactions.postId,
        reactionType: postReactions.reactionType,
        total: count(postReactions.id),
      })
      .from(postReactions)
      .where(inArray(postReactions.postId, postIds))
      .groupBy(postReactions.postId, postReactions.reactionType),
    db
      .select({
        postId: ranked.postId,
        reactionType: ranked.reactionType,
        profileId: ranked.profileId,
        name: ranked.name,
        createdAt: ranked.createdAt,
      })
      .from(ranked)
      .where(lte(ranked.rowNumber, REACTION_PREVIEW_LIMIT)),
    // (c) The caller's own reaction per post. `id desc` matches the preview's
    // tiebreaker so a caller with several rows resolves deterministically.
    profileId
      ? db
          .select({
            postId: postReactions.postId,
            reactionType: postReactions.reactionType,
          })
          .from(postReactions)
          .where(
            and(
              inArray(postReactions.postId, postIds),
              eq(postReactions.profileId, profileId),
            ),
          )
          .orderBy(desc(postReactions.createdAt), desc(postReactions.id))
      : Promise.resolve([]),
  ]);

  counts.forEach((row) => {
    const target = enrichment.get(row.postId);
    if (target) {
      target.reactionCounts[row.reactionType] = Number(row.total);
    }
  });

  previews.forEach((row) => {
    const target = enrichment.get(row.postId);
    if (target) {
      (target.reactionUsers[row.reactionType] ??= []).push({
        id: row.profileId,
        name: row.name,
        timestamp: row.createdAt ? new Date(row.createdAt) : new Date(),
      });
    }
  });

  own.forEach((row) => {
    const target = enrichment.get(row.postId);
    // A post keeps only one reaction per profile in practice; if several
    // exist, the ordering above means the most recent lands first — keep it.
    if (target && target.userReaction === null) {
      target.userReaction = row.reactionType;
    }
  });

  return enrichment;
};

/**
 * Processes posts to add reaction counts, user reactions, and comment counts.
 *
 * The generic constraint uses `any` for the `post` parameter to remain
 * compatible with Drizzle's loosely-typed query results. Reactions are derived
 * from dedicated aggregate queries keyed on the post ids, so callers no longer
 * need to hydrate the full `reactions` relation.
 *
 * @param items - Array of items where each has a post with an id
 * @param profileId - The current user's profile ID to determine their reaction
 * @returns Items with enhanced post data including reaction counts and comment counts
 */
export const getItemsWithReactionsAndComments = async <
  T extends { post: any },
>({
  items,
  profileId,
}: {
  items: T[];
  profileId?: string;
}): Promise<Array<T & { post: T['post'] & EnhancedPostFields }>> => {
  // Get all post IDs to fetch comment counts
  const postIds = items.map((item) => item.post.id).filter(Boolean);

  // Flagged posts only reach enrichment for their author or an admin (the read
  // filters drop them for everyone else), so this decorates exactly the people
  // who should see the "Flagged" indicator.
  const [flaggedIds, reactionsByPostId] = await Promise.all([
    getActivelyFlaggedItemIds('post', postIds),
    getReactionEnrichmentByPostId({ postIds, profileId }),
  ]);

  // Fetch comment counts for all posts in a single query
  const commentCountMap: Record<string, number> = {};
  if (postIds.length > 0) {
    const commentCounts = await db
      .select({
        parentPostId: posts.parentPostId,
        count: count(posts.id),
      })
      .from(posts)
      .where(
        and(
          isNotNull(posts.parentPostId),
          inArray(posts.parentPostId, postIds),
        ),
      )
      .groupBy(posts.parentPostId);

    commentCounts.forEach((row) => {
      if (row.parentPostId) {
        commentCountMap[row.parentPostId] = Number(row.count);
      }
    });
  }

  return items.map((item) => {
    const reactions =
      reactionsByPostId.get(item.post.id) ?? emptyReactionEnrichment();

    // Get comment count for this post
    const commentCount = commentCountMap[item.post.id] || 0;

    return {
      ...item,
      post: {
        ...item.post,
        reactionCounts: reactions.reactionCounts,
        reactionUsers: reactions.reactionUsers,
        userReaction: reactions.userReaction,
        commentCount,
        isFlagged: flaggedIds.has(item.post.id),
      },
    };
  });
};
