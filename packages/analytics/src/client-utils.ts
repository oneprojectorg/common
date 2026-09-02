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
 * `location`/`timezone`/`language` are only populated client-side. The instance
 * id is emitted as `process_id` for backwards compatibility with PostHog.
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

/**
 * Whether this build serves every feature flag as on.
 *
 * Development and end-to-end runs answer `true`, so a contributor and CI meet
 * a new feature without a PostHog project behind them.
 *
 * `useFeatureFlag` in the browser is the only reader. Nothing on the server
 * gates on a flag today.
 */
export const areFeatureFlagsForcedOn = (): boolean =>
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_E2E === 'true';
