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

export interface DecisionCommonProperties {
  process_id: string;
  proposal_id?: string;
  location?: string;
  timezone?: string;
  language?: string;
}

/**
 * Builds the common property bag for decision-making analytics events.
 *
 * Client-safe and the single source of truth (the server `./utils` re-exports
 * it). Firing client-side means `location`/`timezone`/`language` are actually
 * populated, whereas server-side calls always skip them because `window` is
 * undefined.
 *
 * Note: the value is emitted under the `process_id` property for backwards
 * compatibility with existing PostHog dashboards, even though the input is the
 * decision instance id.
 */
export function getDecisionCommonProperties({
  decisionInstanceId,
  proposalId,
  additionalProps,
}: {
  decisionInstanceId: string;
  proposalId?: string;
  additionalProps?: Record<string, unknown>;
}): DecisionCommonProperties & Record<string, unknown> {
  const baseProps: DecisionCommonProperties & Record<string, unknown> = {
    process_id: decisionInstanceId,
    ...additionalProps,
  };

  if (proposalId) {
    baseProps.proposal_id = proposalId;
  }

  if (typeof window !== 'undefined') {
    baseProps.location = window.location.href;
    baseProps.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    baseProps.language = navigator.language;
  }

  return baseProps;
}
