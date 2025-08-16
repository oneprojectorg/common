import { mergeRouters } from '../../trpcFactory';
import { createPost } from './createPost';
import { getPosts } from './getPosts';
import { getOrganizationPosts } from './getOrganizationPosts';

export const postsRouter = mergeRouters(createPost, getPosts, getOrganizationPosts);
