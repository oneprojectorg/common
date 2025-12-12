import { z } from 'zod';

/**
 * Zod schema for query invalidation message
 */
export const invalidationMessageSchema = z.object({
  type: z.literal('query-invalidation'),
  queryKey: z.array(z.string()).readonly(),
});

/**
 * Zod schema for all realtime messages
 */
export const realtimeMessageSchema = invalidationMessageSchema;

/**
 * All possible message types
 */
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
