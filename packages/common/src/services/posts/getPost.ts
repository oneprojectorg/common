import { db } from '@op/db/client';
import {
  EntityType,
  postsToOrganizations,
  postsToProfiles,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import {
  assertProfileTypeAccess,
  getCurrentProfileId,
  getOrgAccessUser,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import { getActivelyFlaggedItemIds } from '../moderation/moderationVisibility';
import {
  getItemsWithReactionsAndComments,
  postModerationFilter,
} from './listPosts';

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

  const actorProfileId = await getCurrentProfileId(authUserId);

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
              // Flagged comments are hidden from the thread for everyone but
              // their author. (Admins review them via the moderation queue,
              // not inline.) Filtered in SQL so the `limit` isn't distorted.
              where: {
                RAW: (table) => postModerationFilter(table, actorProfileId),
              },
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

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: profileIdsToAuthorize,
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  // Resolve the flag state once (reused below for the gate and for the
  // `isFlagged` decoration, so the moderation_flags table is hit a single time).
  const flaggedItemIds = await getActivelyFlaggedItemIds('post', [post.id]);

  // Moderation gate: a post with an active flag is visible only to its author
  // and admins of the entities that govern it. Returns null (same as a missing
  // post) so existence doesn't leak. Admin standing comes from two places: a
  // governing profile (with org fallback, since org admins' roles live on
  // `organizationUsers`, not `profileUsers`) or — for org-feed posts, which
  // carry no governing profile and link to the org only via
  // `postsToOrganizations` — the post's organizations directly.
  const isAuthor = post.profileId === actorProfileId;
  if (flaggedItemIds.has(post.id) && !isAuthor) {
    const user = { id: authUserId };
    const orgRows = await db
      .select({ organizationId: postsToOrganizations.organizationId })
      .from(postsToOrganizations)
      .where(eq(postsToOrganizations.postId, post.id));

    // The caller's roles across every entity that governs the post.
    const governingRoles = (
      await Promise.all([
        ...profileIdsToAuthorize.map((pid) =>
          getProfileAccessRolesWithOrgFallback({ user, profileId: pid }),
        ),
        ...orgRows.map(({ organizationId }) =>
          getOrgAccessUser({ user, organizationId }).then(
            (orgUser) => orgUser?.roles ?? [],
          ),
        ),
      ])
    ).flat();

    if (!checkPermission({ profile: permission.ADMIN }, governingRoles)) {
      return null;
    }
  }

  const itemsWithReactionsAndComments = await getItemsWithReactionsAndComments({
    items: [{ post }],
    profileId: actorProfileId,
    flaggedItemIds,
  });

  return itemsWithReactionsAndComments[0]?.post ?? null;
};
