import { z } from 'zod';

// Legacy schema for backward compatibility
export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  commentableType: z.string().min(1),
  commentableId: z.uuid(),
  parentCommentId: z.uuid().optional(),
});

export const updateCommentSchema = z.object({
  id: z.uuid(),
  content: z.string().min(1).max(2000),
});

export const deleteCommentSchema = z.object({
  id: z.uuid(),
});

// Legacy schema
export const getCommentsSchema = z.object({
  commentableType: z.string().min(1),
  commentableId: z.uuid(),
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

export const getCommentSchema = z.object({
  id: z.uuid(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
export type GetCommentsInput = z.infer<typeof getCommentsSchema>;
export type GetCommentInput = z.infer<typeof getCommentSchema>;
