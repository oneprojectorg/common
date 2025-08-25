import { mergeRouters } from '../../trpcFactory';
import { createPost } from './createPost';
import { getOrganizationPosts } from './getOrganizationPosts';
import { getPosts } from './getPosts';
import { uploadPostAttachment } from './uploadPostAttachment';

export const postsRouter = mergeRouters(
  createPost,
  getPosts,
  getOrganizationPosts,
  uploadPostAttachment,
);
