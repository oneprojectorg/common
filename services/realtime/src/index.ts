/**
 * @op/realtime - Real-time messaging service
 *
 * This package provides both server-side and client-side real-time functionality:
 *
 * - Server-side: HTTP API for publishing messages to channels
 * - Client-side: WebSocket manager for subscribing to channels and receiving messages
 *
 * Usage:
 * ```ts
 * // Server-side (API routes, tRPC mutations)
 * import { publishMessage, Channels } from '@op/realtime/server';
 *
 * await publishMessage(Channels.user(userId), {
 *   type: 'cache-invalidation',
 *   queryKey: ['user', 'notifications'],
 *   timestamp: Date.now(),
 * });
 *
 * // Client-side (React components)
 * import { CentrifugeManager, Channels } from '@op/realtime/client';
 *
 * const manager = CentrifugeManager.getInstance();
 * manager.subscribe(Channels.user(userId), (data) => {
 *   console.log('Received:', data);
 * });
 * ```
 */

// Re-export shared types and utilities
export { Channels } from './channels';
export type { GlobalChannel, OrgChannel, UserChannel } from './channels';
export type {
  CentrifugoMessage,
  InvalidationMessage,
  BaseMessage,
} from './types';
