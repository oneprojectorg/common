/**
 * Header name used to pass mutation channels from server to client.
 * The client extracts these channels and subscribes to realtime updates.
 */
export const MUTATION_CHANNELS_HEADER = 'x-mutation-channels';

/**
 * Header name used to pass subscription channels from server to client.
 * The client uses these to register query keys for channel-based invalidation.
 */
export const SUBSCRIPTION_CHANNELS_HEADER = 'x-subscription-channels';
