import { db } from '@op/db/client';
import {
  EntityType,
  postsToOrganizations,
  postsToProfiles,
  profiles,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';
import { eq, inArray } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  assertProfileTypeAccess,
  getCurrentProfileId,
  getOrgAccessUser,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import { hasActiveModerationFlag } from '../moderation/moderationVisibility';
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

  // Individual / user profile posts aren't a supported surface yet: deny
  // before any permission policy can lenient-pass them. Same DB roundtrip
  // also feeds the DECISION gate below — split into two queries would be a
  // strict regression, so check the type set explicitly here.
  if (profileIdsToAuthorize.length > 0) {
    const profileTypes = await db
      .select({ type: profiles.type })
      .from(profiles)
      .where(inArray(profiles.id, profileIdsToAuthorize));

    if (
      profileTypes.some(
        ({ type }) =>
          type === EntityType.INDIVIDUAL || type === EntityType.USER,
      )
    ) {
      throw new UnauthorizedError('You do not have access to this post');
    }
  }

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: profileIdsToAuthorize,
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  // Moderation gate: a post with an active flag is visible only to its author
  // and admins of the entities that govern it. Returns null (same as a missing
  // post) so existence doesn't leak. Admin standing comes from two places: a
  // governing profile (with org fallback, since org admins' roles live on
  // `organizationUsers`, not `profileUsers`) or — for org-feed posts, which
  // carry no governing profile and link to the org only via
  // `postsToOrganizations` — the post's organizations directly.
  const isAuthor = post.profileId === actorProfileId;
  if ((await hasActiveModerationFlag('post', post.id)) && !isAuthor) {
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
  });

  return itemsWithReactionsAndComments[0]?.post ?? null;
};
