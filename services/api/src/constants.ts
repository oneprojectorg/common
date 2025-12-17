/**
 * Header name used to pass channels that a mutation invalidates.
 * The client uses these to trigger refetches for queries subscribed to those channels.
 */
export const MUTATION_CHANNELS_HEADER = 'x-mutation-channels';

/**
 * Header name used to pass channels that a query subscribes to.
 * The client registers the query for invalidation when mutations publish to these channels.
 */
export const QUERY_CHANNELS_HEADER = 'x-query-channels';
