import { posthogUIHost } from '@op/core';

/**
 * Client-safe analytics utility functions that don't require Node.js APIs
 */

/**
 * Generates an analytics user URL for a given distinct user ID.
 * PostHog rewrites URLs to include the project ID.
 * This is safe to use in both client and server contexts.
 */
export const getAnalyticsUserUrl = (distinctUserId: string) => {
  return `${posthogUIHost}/person/${encodeURIComponent(distinctUserId)}`;
};
