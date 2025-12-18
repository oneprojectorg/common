import { z } from 'zod';

/**
 * Zod schema for query invalidation message.
 * Used to broadcast cache invalidations across clients.
 * The mutationId links back to the originating mutation for deduplication.
 */
export const invalidationMessageSchema = z.object({
  mutationId: z.string(),
});

/**
 * Zod schema for all realtime messages.
 * Extend with z.discriminatedUnion when adding more message types.
 */
export const realtimeMessageSchema = invalidationMessageSchema;

/**
 * All possible message types
 */
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
