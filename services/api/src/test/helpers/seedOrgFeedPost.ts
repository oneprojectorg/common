import { db } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';

/**
 * Seeds an org-feed post via direct DB insert, bypassing the
 * `assertPostWriteAccess` gate. The modern `posts.createPost({ profileId:
 * orgProfile })` shape used to be the convenient seeding path, but
 * top-level writes on the org profile are now rejected by that endpoint
 * (production goes through `organization.createPost`). Tests that need
 * the modern `posts.profileId / rootProfileId / postsToProfiles → org`
 * shape as a *fixture* (delete-permission regressions, feed-read /
 * reaction pinning, allow-list comment tests) reach for this instead.
 *
 * Cleanup is handled by the surrounding `TestDecisionsDataManager`'s
 * profile-cascade teardown — pass org/author profile ids the manager
 * already tracks.
 */
export const seedOrgFeedPost = async ({
  content,
  authorProfileId,
  orgProfileId,
}: {
  content: string;
  authorProfileId: string;
  orgProfileId: string;
}) => {
  const [post] = await db
    .insert(posts)
    .values({
      content,
      profileId: authorProfileId,
      rootProfileId: orgProfileId,
    })
    .returning();
  if (!post) {
    throw new Error('Failed to seed org-feed post');
  }
  await db.insert(postsToProfiles).values({
    postId: post.id,
    profileId: orgProfileId,
  });
  return post;
};
