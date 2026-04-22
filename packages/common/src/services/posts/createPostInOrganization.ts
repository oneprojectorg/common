import { db } from '@op/db/client';
import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';

import { getOrgAccessUser } from '../';
import { CommonError, UnauthorizedError } from '../../utils/error';

export interface CreatePostInOrganizationOptions {
  id: string;
  content: string;
  attachmentIds?: string[];
  user: User;
}

export const createPostInOrganization = async (
  options: CreatePostInOrganizationOptions,
) => {
  const { id, content, attachmentIds = [], user } = options;

  const orgUser = await getOrgAccessUser({
    organizationId: id,
    user,
  });

  if (!orgUser) {
    throw new UnauthorizedError();
  }

  // Get all storage objects that were attached to the post
  const allStorageObjects =
    attachmentIds.length > 0
      ? await db._query.objectsInStorage.findMany({
          where: (table, { inArray }) => inArray(table.id, attachmentIds),
        })
      : [];

  const [post] = await db
    .insert(posts)
    .values({
      content,
    })
    .returning();

  if (!post) {
    throw new CommonError('Failed to add post to organization');
  }

  // Create the join record associating the post with the organization
  const queryPromises: Promise<any>[] = [
    db.insert(postsToOrganizations).values({
      organizationId: id,
      postId: post.id,
    }),
  ];

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

    queryPromises.push(db.insert(attachments).values(attachmentValues));
  }

  // Run attachments and join record in parallel
  await Promise.all(queryPromises);

  return {
    result: {
      ...post,
      reactionCounts: {},
      userReactions: [],
      commentCount: 0,
    },
    allStorageObjects,
  };
};
