import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  commentableType: z.string().min(1),
  commentableId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export const deleteCommentSchema = z.object({
  id: z.string().uuid(),
});

export const getCommentsSchema = z.object({
  commentableType: z.string().min(1),
  commentableId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const getCommentSchema = z.object({
  id: z.string().uuid(),
});

// New schemas for join table operations
export const createCommentForPostSchema = z.object({
  content: z.string().min(1).max(2000),
  postId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
});


export const getCommentsForPostSchema = z.object({
  postId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});


export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
export type GetCommentsInput = z.infer<typeof getCommentsSchema>;
export type GetCommentInput = z.infer<typeof getCommentSchema>;
export type CreateCommentForPostInput = z.infer<typeof createCommentForPostSchema>;
export type GetCommentsForPostInput = z.infer<typeof getCommentsForPostSchema>;