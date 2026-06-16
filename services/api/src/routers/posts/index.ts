import { mergeRouters } from '../../trpcFactory';
import { createPost } from './createPost';
import { getPost } from './getPost';
import { getPosts } from './getPosts';
import { uploadPostAttachment } from './uploadPostAttachment';

export const postsRouter = mergeRouters(
  createPost,
  getPost,
  getPosts,
  uploadPostAttachment,
);
