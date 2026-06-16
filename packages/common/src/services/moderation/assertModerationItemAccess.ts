import { db, eq } from '@op/db/client';
import {
  EntityType,
  Visibility,
  posts,
  postsToProfiles,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import {
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getCurrentProfileId,
  getProfileAccessUser,
} from '../access';
import { hasActiveModerationFlag } from './moderationVisibility';
import type { ModerationItemType } from './types';

/**
 * Asserts the reporter can actually see the item they're flagging, and that it
 * exists. Flagging ships the item's text and signed attachment URLs to the
 * external moderation provider, so it must be gated like reading the item —
 * otherwise an authenticated session could exfiltrate restricted content (or
 * probe for ids) by flagging it. Mirrors the read-path checks: posts gate like
 * `getPost`, proposals like `getProposal`; user profiles are platform-visible,
 * so a user item only needs to exist.
 *
 * Two intentional carve-outs from the read path:
 *  - DRAFT proposals are NOT gated here — drafts are reportable.
 *  - HIDDEN proposals and already-flagged posts ARE gated, so content that's
 *    restricted from a reader can't be shipped to the vendor by flagging it.
 */
export const assertModerationItemAccess = async ({
  itemType,
  itemId,
  user,
}: {
  itemType: ModerationItemType;
  itemId: string;
  user: User;
}): Promise<void> => {
  if (itemType === 'post') {
    const [post] = await db
      .select({
        id: posts.id,
        profileId: posts.profileId,
        rootProfileId: posts.rootProfileId,
      })
      .from(posts)
      .where(eq(posts.id, itemId))
      .limit(1);
    if (!post) {
      throw new NotFoundError('Post', itemId);
    }

    // Prefer the pinned rootProfileId gate when present; legacy posts written
    // before the gate fall back to the postsToProfiles index (same as getPost).
    const profileIds = post.rootProfileId
      ? [post.rootProfileId]
      : (
          await db
            .select({ profileId: postsToProfiles.profileId })
            .from(postsToProfiles)
            .where(eq(postsToProfiles.postId, itemId))
        ).map((row) => row.profileId);

    await assertProfileTypeAccess({
      user,
      profileIds,
      policies: {
        [EntityType.DECISION]: { decisions: permission.READ },
      },
    });

    // An already-flagged post is hidden from everyone but its author and the
    // root-profile admins (see getPost's gate); the same audience may flag it,
    // so a non-owner can't ship hidden content to the vendor by re-flagging.
    if (await hasActiveModerationFlag('post', post.id)) {
      const actorProfileId = await getCurrentProfileId(user.id);
      const isAuthor = post.profileId === actorProfileId;
      if (!isAuthor) {
        const rootProfileUser = post.rootProfileId
          ? await getProfileAccessUser({ user, profileId: post.rootProfileId })
          : undefined;
        const isAdmin = checkPermission(
          { profile: permission.ADMIN },
          rootProfileUser?.roles ?? [],
        );
        if (!isAdmin) {
          throw new NotFoundError('Post', itemId);
        }
      }
    }
    return;
  }

  if (itemType === 'proposal') {
    const proposal = await db.query.proposals.findFirst({
      where: { id: itemId },
      with: { processInstance: true },
    });
    if (!proposal) {
      throw new NotFoundError('Proposal', itemId);
    }

    // Reuse the resolved instance-profile user for the instance-admin check
    // below instead of re-fetching it, mirroring getProposal.
    const instanceProfileUser = await assertInstanceProfileAccess({
      user,
      instance: proposal.processInstance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: [
        { decisions: permission.READ },
        { decisions: permission.ADMIN },
      ],
    });

    // HIDDEN proposals, and proposals with an active moderation flag, are
    // restricted beyond plain instance read — visible only to proposal-level
    // members (creator + invited collaborators) or instance admins. Mirror
    // getProposal's gate so restricted text/attachments can't be shipped to the
    // vendor by an instance member who only has read on the process, and so
    // this gate (not submitUserFlag's idempotency shortcut) is what enforces it
    // for an already-flagged proposal. (DRAFT is deliberately not gated here:
    // drafts are reportable.)
    const isRestricted =
      proposal.visibility === Visibility.HIDDEN ||
      (await hasActiveModerationFlag('proposal', proposal.id));
    if (isRestricted) {
      const proposalProfileUser = await getProfileAccessUser({
        user,
        profileId: proposal.profileId,
      });
      const isInstanceAdmin = checkPermission(
        { profile: permission.ADMIN },
        instanceProfileUser?.roles ?? [],
      );
      if (!proposalProfileUser && !isInstanceAdmin) {
        throw new NotFoundError('Proposal', itemId);
      }
    }
    return;
  }

  // itemType === 'user': profiles are platform-visible, so existence is the
  // only gate — a nonexistent id must not create a queue entry or an email.
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, itemId))
    .limit(1);
  if (!row) {
    throw new NotFoundError('User', itemId);
  }
};
