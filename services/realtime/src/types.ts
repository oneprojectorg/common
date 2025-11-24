/**
 * Cache invalidation message
 */
export interface InvalidationMessage {
  type: 'cache-invalidation';
  queryKey: readonly unknown[];
}

/**
 * All possible message types
 */
export type RealtimeMessage = InvalidationMessage;
