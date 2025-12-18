import { z } from 'zod';

/**
 * Zod schema for query invalidation message
 */
export const invalidationMessageSchema = z.object({
  type: z.literal('query-invalidation'),
  mutationId: z.string().optional(),
});

/**
 * Zod schema for all realtime messages
 */
export const realtimeMessageSchema = invalidationMessageSchema;

/**
 * All possible message types
 */
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
