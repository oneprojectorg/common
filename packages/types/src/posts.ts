import { z } from 'zod';

// Unified post creation schema
export const createPostSchema = z.object({
  content: z.string().min(0).max(10000),
  parentPostId: z.uuid().optional(), // If provided, this becomes a comment/reply
  profileId: z.uuid().optional(), // Profile to associate the post with
  attachmentIds: z.array(z.string()).optional().prefault([]),
  // Optional proposal context for analytics
  proposalId: z.uuid().optional(),
  processInstanceId: z.uuid().optional(),
});

// Single post fetching schema
export const getPostSchema = z.object({
  postId: z.uuid(),
  includeChildren: z.boolean().prefault(false),
  maxDepth: z.number().min(1).max(5).prefault(3),
});

// Unified post fetching schema
export const getPostsSchema = z.object({
  profileId: z.uuid().optional(), // Profile to get posts for
  parentPostId: z.uuid().optional().nullable(), // null for top-level posts, string for comments of that post, undefined for all levels
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
  includeChildren: z.boolean().prefault(false),
  maxDepth: z.number().min(1).max(5).prefault(3),
});

// Organization posts fetching schema
export const getOrganizationPostsSchema = z.object({
  organizationId: z.uuid(), // Required organization ID
  parentPostId: z.uuid().optional().nullable(), // null for top-level posts, string for comments of that post, undefined for all levels
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
  includeChildren: z.boolean().prefault(false),
  maxDepth: z.number().min(1).max(5).prefault(3),
});

export const updatePostSchema = z.object({
  id: z.uuid(),
  content: z.string().min(1).max(10000),
});

export const deletePostSchema = z.object({
  id: z.uuid(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type GetPostInput = z.infer<typeof getPostSchema>;
export type GetPostsInput = z.infer<typeof getPostsSchema>;
export type GetOrganizationPostsInput = z.infer<
  typeof getOrganizationPostsSchema
>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type DeletePostInput = z.infer<typeof deletePostSchema>;
