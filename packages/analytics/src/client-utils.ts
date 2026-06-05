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
 * Client-safe mirror of the server helper in `./utils`. Prefer this when
 * tracking decision events from the frontend (e.g. `proposal_viewed`,
 * `process_viewed`): firing client-side means `location`/`timezone`/`language`
 * are actually populated, whereas server-side calls always skip them because
 * `window` is undefined.
 */
export function getDecisionCommonProperties(
  processId: string,
  proposalId?: string,
  additionalProps?: Record<string, unknown>,
): DecisionCommonProperties & Record<string, unknown> {
  const baseProps: DecisionCommonProperties & Record<string, unknown> = {
    process_id: processId,
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
