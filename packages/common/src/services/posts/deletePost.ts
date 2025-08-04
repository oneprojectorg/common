import { and, db, eq } from '@op/db/client';
import { organizations, posts, postsToOrganizations } from '@op/db/schema';

export interface DeletePostByIdOptions {
  postId: string;
  profileId?: string;
  organizationId?: string;
}

export const deletePostById = async (options: DeletePostByIdOptions) => {
  const { postId, profileId, organizationId } = options;

  if (!profileId && !organizationId) {
    throw new Error('Either profileId or organizationId must be provided');
  }

  let query = db
    .select({ postId: posts.id })
    .from(posts)
    .innerJoin(postsToOrganizations, eq(posts.id, postsToOrganizations.postId));

  let whereConditions = [eq(posts.id, postId)];

  if (organizationId) {
    whereConditions.push(
      eq(postsToOrganizations.organizationId, organizationId),
    );
  } else if (profileId) {
    query = query.innerJoin(
      organizations,
      eq(postsToOrganizations.organizationId, organizations.id),
    );
    whereConditions.push(eq(organizations.profileId, profileId));
  }

  const postExists = await query.where(and(...whereConditions)).limit(1);

  if (!postExists.length) {
    throw new Error(
      'Post not found or does not belong to the specified organization',
    );
  }

  await db.delete(posts).where(eq(posts.id, postId));

  return { success: true };
};
