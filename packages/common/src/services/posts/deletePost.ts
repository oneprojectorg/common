import { db, eq, sql } from '@op/db/client';
import {
  organizations,
  posts,
  postsToOrganizations,
  postsToProfiles,
} from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  getProfileAccessUser,
} from '../access';

export interface DeletePostByIdOptions {
  postId: string;
  user: User;
}

export const deletePostById = async (options: DeletePostByIdOptions) => {
  const { postId, user } = options;

  // Pull the post plus the linked org's profileId in one round trip. The org
  // profile stands in as the gate for legacy postsToOrganizations posts and
  // is what assertInstanceProfileAccess looks up to resolve the org for the
  // organizationUsers fallback. The join walks up via `rootPostId` so a
  // comment on a legacy org-feed post inherits its root post's org link —
  // comments never get their own postsToOrganizations row, and legacy roots
  // never set rootProfileId, so without this walk org admins can't moderate
  // replies under legacy posts.
  const [postRows, currentProfileId] = await Promise.all([
    db
      .select({
        id: posts.id,
        profileId: posts.profileId,
        rootProfileId: posts.rootProfileId,
        orgProfileId: organizations.profileId,
      })
      .from(posts)
      .leftJoin(
        postsToOrganizations,
        sql`${postsToOrganizations.postId} = coalesce(${posts.rootPostId}, ${posts.id})`,
      )
      .leftJoin(
        organizations,
        eq(organizations.id, postsToOrganizations.organizationId),
      )
      .where(eq(posts.id, postId))
      .limit(1),
    getCurrentProfileId(user.id),
  ]);
  const post = postRows[0];

  if (!post) {
    // Mirror the unauthorized branch to avoid leaking post existence to
    // outsiders who guess IDs.
    throw new UnauthorizedError();
  }

  // Author fast-path: actor's current profile matches the post's profileId
  // AND they hold a profileUsers row on it. The currentProfileId match alone
  // is NOT sufficient — `account.switchOrganization` only requires org
  // membership, so any member can land on `currentProfileId = orgProfileId`.
  // Org members never get a profileUsers row on org profiles (orgs grant
  // access via organizationUsers), so the extra check blocks the spoof while
  // preserving the legitimate self-delete path for individual and decision-
  // instance authors.
  if (post.profileId && post.profileId === currentProfileId) {
    const profileUser = await getProfileAccessUser({
      user,
      profileId: post.profileId,
    });
    if (profileUser) {
      await db.delete(posts).where(eq(posts.id, postId));
      return;
    }
  }

  // Pre-`rootProfileId` posts (e.g. `createPostOnProfile`) stored the gate
  // as a postsToProfiles row instead. Read it lazily so the join above
  // stays the common-case single round trip.
  let gateProfileId: string | null =
    post.rootProfileId ?? post.orgProfileId ?? null;
  if (!gateProfileId) {
    const [legacy] = await db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, postId))
      .limit(1);
    gateProfileId = legacy?.profileId ?? null;
  }

  // ADMIN on the gate profile, falling back to organizationUsers ADMIN when
  // the gate IS an org's profile (rootProfileId on a top-level org-feed post,
  // or the org profile we substituted for a legacy postsToOrganizations
  // post). For decision-instance and individual gate profiles the org lookup
  // returns no rows and the fallback fails, matching the previous behavior.
  await assertInstanceProfileAccess({
    user,
    instance: {
      profileId: gateProfileId,
      ownerProfileId: gateProfileId,
    },
    profilePermissions: { profile: permission.ADMIN },
    orgFallbackPermissions: { profile: permission.ADMIN },
  });

  await db.delete(posts).where(eq(posts.id, postId));
};
