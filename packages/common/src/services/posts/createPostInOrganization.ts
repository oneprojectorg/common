import { type DbClient, db as defaultDb } from '@op/db/client';
import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { getOrgAccessUser } from '../';
import { CommonError, UnauthorizedError } from '../../utils/error';

export interface CreatePostInOrganizationOptions {
  id: string;
  content: string;
  attachmentIds?: string[];
  user: User;
  db?: DbClient;
}

export const createPostInOrganization = async (
  options: CreatePostInOrganizationOptions,
) => {
  const { id, content, attachmentIds = [], user, db = defaultDb } = options;

  const orgUser = await getOrgAccessUser({
    organizationId: id,
    user,
  });

  if (!orgUser) {
    throw new UnauthorizedError();
  }

  // The post, its organization association, and its attachment rows are one
  // unit — a partial write leaves a post with no owning org, or an org post
  // whose uploads never got linked.
  const { post, allStorageObjects } = await db.transaction(async (tx) => {
    // Get all storage objects that were attached to the post
    const allStorageObjects =
      attachmentIds.length > 0
        ? await tx._query.objectsInStorage.findMany({
            where: (table, { inArray }) => inArray(table.id, attachmentIds),
          })
        : [];

    const [post] = await tx
      .insert(posts)
      .values({
        content,
      })
      .returning();

    if (!post) {
      throw new CommonError('Failed to add post to organization');
    }

    // Create the join record associating the post with the organization
    await tx.insert(postsToOrganizations).values({
      organizationId: id,
      postId: post.id,
    });

    // Create attachment records if any attachments were uploaded
    if (allStorageObjects.length > 0) {
      const attachmentValues = allStorageObjects.map((storageObject) => ({
        postId: post.id,
        storageObjectId: storageObject.id,
        uploadedBy: orgUser.id,
        fileName:
          storageObject?.name
            ?.split('/')
            .slice(-1)[0]
            ?.split('_')
            .slice(1)
            .join('_') ?? '',
        mimeType: (storageObject.metadata as { mimetype: string }).mimetype,
      }));

      await tx.insert(attachments).values(attachmentValues);
    }

    return { post, allStorageObjects };
  });

  // Org posts are intentionally not moderated (neither a sync gate nor the
  // async `content/submitted` review path that decision/profile posts use).

  return {
    result: {
      ...post,
      likeCount: 0,
      userHasLiked: false,
      likeUsers: [],
      commentCount: 0,
    },
    allStorageObjects,
  };
};
