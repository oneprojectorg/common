import { db } from '@op/db/client';
import {
  EntityType,
  posts as postsTable,
  postsToProfiles,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';
import { and, desc, eq, isNull } from 'drizzle-orm';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getCurrentProfileId,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import {
  getItemsWithReactionsAndComments,
  postModerationFilter,
} from './listPosts';

/**
 * Fetches a page of a profile's top-level posts (no replies), applying the
 * caller-aware moderation filter and keyset pagination.
 *
 * Authorization is the caller's responsibility: `listProfilePosts` gates on
 * the decision profile itself, while `listProposalPosts` gates on the
 * proposal's parent decision. This helper assumes the caller has already
 * proven read access to `profileId`.
 */
const fetchTopLevelProfilePostsPage = async ({
  user,
  profileId,
  limit,
  cursor,
}: {
  user: AccessUser | undefined;
  profileId: string;
  limit: number;
  cursor?: string | null;
}) => {
  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

  const cursorCondition = decodedCursor
    ? getGenericCursorCondition({
        columns: {
          id: postsToProfiles.postId,
          date: postsToProfiles.createdAt,
        },
        cursor: decodedCursor,
      })
    : undefined;

  // The caller's profile + admin standing on this profile drive the
  // moderation filter below: flagged posts stay visible to their author and
  // to profile admins, hidden from everyone else.
  const [actorProfileId, governingRoles] = await Promise.all([
    user ? getCurrentProfileId(user.id) : undefined,
    getProfileAccessRolesWithOrgFallback({ user, profileId }),
  ]);
  const isProfileAdmin = checkPermission(
    { profile: permission.ADMIN },
    governingRoles,
  );

  // Filter top-level posts at the SQL level so pagination doesn't under-fetch
  // when comments inherit profile associations from their parent. A relational
  // `where: { post: { parentPostId: isNull } }` produces a LEFT JOIN that
  // returns nulls for filtered rows — paginating on those rows silently drops
  // pages. The moderation filter rides on the same join for the same reason.
  const pageRows = await db
    .select({
      postId: postsToProfiles.postId,
      createdAt: postsToProfiles.createdAt,
    })
    .from(postsToProfiles)
    .innerJoin(
      postsTable,
      and(
        eq(postsTable.id, postsToProfiles.postId),
        isNull(postsTable.parentPostId),
        isProfileAdmin
          ? undefined
          : postModerationFilter(postsTable, actorProfileId),
      ),
    )
    .where(
      cursorCondition
        ? and(eq(postsToProfiles.profileId, profileId), cursorCondition)
        : eq(postsToProfiles.profileId, profileId),
    )
    .orderBy(desc(postsToProfiles.createdAt), desc(postsToProfiles.postId))
    .limit(limit + 1);

  const hasMore = pageRows.length > limit;
  const pageItems = pageRows.slice(0, limit);
  const postIds = pageItems.map((row) => row.postId);

  const hydrated = postIds.length
    ? await db.query.posts.findMany({
        where: { id: { in: postIds } },
        with: {
          profile: { with: { avatarImage: true } },
          attachments: { with: { storageObject: true } },
          reactions: { with: { profile: true } },
        },
      })
    : [];

  const postById = new Map(hydrated.map((post) => [post.id, post]));
  const orderedPosts = postIds
    .map((id) => postById.get(id))
    .filter((post): post is NonNullable<typeof post> => post !== undefined);

  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem && lastItem.createdAt
      ? encodeCursor({
          date: new Date(lastItem.createdAt),
          id: lastItem.postId,
        })
      : null;

  const itemsWithReactions = await getItemsWithReactionsAndComments({
    items: orderedPosts.map((post) => ({ post })),
    profileId: actorProfileId,
  });

  return {
    items: itemsWithReactions.map((item) => item.post),
    next: nextCursor,
  };
};

export const listProfilePosts = async ({
  user,
  profileId,
  limit = 20,
  cursor,
}: {
  user: AccessUser | undefined;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  // Scoped to decision profiles: assertProfileTypeAccess leniently passes
  // ungated types, which would leak org/individual posts to public callers.
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { type: true },
  });

  if (profile?.type !== EntityType.DECISION) {
    throw new UnauthorizedError('You do not have access to these posts');
  }

  await assertProfileTypeAccess({
    user,
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  return fetchTopLevelProfilePostsPage({ user, profileId, limit, cursor });
};

/**
 * Lists a proposal profile's top-level discussion posts.
 *
 * A proposal's profile is type PROPOSAL, which `assertProfileTypeAccess` would
 * leniently pass (no authorization at all). The READ grant for a proposal
 * lives on its parent decision profile, NEVER on the proposal profile itself —
 * so we gate on the parent decision exactly as `getProposal` does, via
 * `assertInstanceProfileAccess` on the proposal's process instance.
 */
export const listProposalPosts = async ({
  user,
  profileId,
  limit = 20,
  cursor,
}: {
  user: AccessUser | undefined;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId },
    with: { processInstance: true },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', profileId);
  }

  await assertInstanceProfileAccess({
    user,
    instance: proposal.processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  return fetchTopLevelProfilePostsPage({ user, profileId, limit, cursor });
};
