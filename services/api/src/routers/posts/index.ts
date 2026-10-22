import { mergeRouters } from '../../trpcFactory';
import { createPost } from './createPost';
import { getPost } from './getPost';
import { getPosts } from './getPosts';
import { listProfilePosts } from './listProfilePosts';
import { listProposalComments } from './listProposalComments';
import { uploadPostAttachment } from './uploadPostAttachment';

export const postsRouter = mergeRouters(
  createPost,
  getPost,
  getPosts,
  listProfilePosts,
  listProposalComments,
  uploadPostAttachment,
);
