import { z } from 'zod';

// Unified post creation schema
export const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  parentPostId: z.string().uuid().optional(), // If provided, this becomes a comment/reply
  organizationId: z.string().uuid().optional(), // For organization posts
});

// Unified post fetching schema
export const getPostsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  parentPostId: z.string().uuid().optional().nullable(), // null for top-level posts, string for comments of that post, undefined for all levels
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  includeChildren: z.boolean().default(false),
  maxDepth: z.number().min(1).max(5).default(3),
});

export const updatePostSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export const deletePostSchema = z.object({
  id: z.string().uuid(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type GetPostsInput = z.infer<typeof getPostsSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type DeletePostInput = z.infer<typeof deletePostSchema>;