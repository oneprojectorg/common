/**
 * Query invalidation message
 */
export interface InvalidationMessage {
  type: 'query-invalidation';
  queryKey: readonly unknown[];
}

/**
 * All possible message types
 */
export type RealtimeMessage = InvalidationMessage;
