/**
 * Base message structure for all realtime messages
 */
export interface BaseMessage {
  type: string;
  timestamp: number;
}

/**
 * Cache invalidation message
 */
export interface InvalidationMessage extends BaseMessage {
  type: 'cache-invalidation';
  queryKey: readonly unknown[];
  mutationId?: string;
}

/**
 * All possible message types
 */
export type RealtimeMessage = InvalidationMessage;
