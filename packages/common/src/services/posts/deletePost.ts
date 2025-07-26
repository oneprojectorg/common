import { db, eq, and } from '@op/db/client';
import { posts, postsToOrganizations } from '@op/db/schema';

export interface DeletePostByIdOptions {
  postId: string;
  organizationId: string;
}

export const deletePostById = async (options: DeletePostByIdOptions) => {
  const { postId, organizationId } = options;
  // Verify the post exists and belongs to the organization
  const postExists = await db
    .select()
    .from(posts)
    .innerJoin(
      postsToOrganizations,
      eq(posts.id, postsToOrganizations.postId),
    )
    .where(
      and(
        eq(posts.id, postId),
        eq(postsToOrganizations.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!postExists.length) {
    throw new Error('Post not found or does not belong to the specified organization');
  }

  await db.delete(posts).where(eq(posts.id, postId));

  return { success: true };
};