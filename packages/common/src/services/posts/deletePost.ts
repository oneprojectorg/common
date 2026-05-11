import { db, eq, inArray } from '@op/db/client';
import {
  posts,
  postsToOrganizations,
  postsToProfiles,
  processInstances,
  proposals,
} from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils/error';
import {
  assertInstanceProfileAccess,
  getIndividualProfileId,
  getOrgAccessUser,
} from '../access';

export interface DeletePostByIdOptions {
  postId: string;
  user: User;
}

export const deletePostById = async (options: DeletePostByIdOptions) => {
  const { postId, user } = options;

  const [targetPost] = await db
    .select({
      id: posts.id,
      profileId: posts.profileId,
      parentPostId: posts.parentPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!targetPost) {
    throw new NotFoundError('Post', postId);
  }

  // Author self-delete: caller is the post's author.
  const callerIndividualProfileId = await getIndividualProfileId(user.id).catch(
    () => null,
  );

  if (
    callerIndividualProfileId &&
    targetPost.profileId === callerIndividualProfileId
  ) {
    await db.delete(posts).where(eq(posts.id, postId));
    return;
  }

  // Comments inherit their parent's org/profile associations only via
  // postsToProfiles; postsToOrganizations is set only on the top-level post.
  // Walk up to the parent for the org-membership lookup.
  const lookupPostId = targetPost.parentPostId ?? targetPost.id;

  // Org-admin delete: post (or its parent) belongs to an organization the
  // caller has admin access to.
  const orgLinks = await db
    .select({ organizationId: postsToOrganizations.organizationId })
    .from(postsToOrganizations)
    .where(eq(postsToOrganizations.postId, lookupPostId));

  for (const { organizationId } of orgLinks) {
    const orgUser = await getOrgAccessUser({ organizationId, user });
    if (
      orgUser &&
      checkPermission({ admin: permission.DELETE }, orgUser.roles)
    ) {
      await db.delete(posts).where(eq(posts.id, postId));
      return;
    }
  }

  // Process-admin delete: post is associated with a proposal's profile, and
  // the caller has admin rights on that proposal's process instance.
  const profileLinks = await db
    .select({ profileId: postsToProfiles.profileId })
    .from(postsToProfiles)
    .where(eq(postsToProfiles.postId, lookupPostId));

  if (profileLinks.length > 0) {
    const linkedProfileIds = profileLinks.map((l) => l.profileId);

    const matchingProposals = await db
      .select({
        processInstanceId: proposals.processInstanceId,
      })
      .from(proposals)
      .where(inArray(proposals.profileId, linkedProfileIds));

    const processInstanceIds = matchingProposals.map(
      (p) => p.processInstanceId,
    );

    if (processInstanceIds.length > 0) {
      const instances = await db
        .select({
          profileId: processInstances.profileId,
          ownerProfileId: processInstances.ownerProfileId,
        })
        .from(processInstances)
        .where(inArray(processInstances.id, processInstanceIds));

      for (const instance of instances) {
        try {
          await assertInstanceProfileAccess({
            user,
            instance,
            profilePermissions: { decisions: permission.ADMIN },
            orgFallbackPermissions: [{ decisions: permission.ADMIN }],
          });
          await db.delete(posts).where(eq(posts.id, postId));
          return;
        } catch {
          // Try the next process instance.
        }
      }
    }
  }

  throw new UnauthorizedError();
};
