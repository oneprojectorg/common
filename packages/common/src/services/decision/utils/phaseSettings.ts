import {
  DEFAULT_REVIEWS_POLICY,
  DEFAULT_REVIEWS_SCOPE,
} from '../schemas/types';
import type { PhaseReviewSettings, ReviewsPolicy } from '../schemas/types';
import { assertInstancePhase } from './instance';

/**
 * Phase-level settings resolution: `rules.<domain>` → legacy `config.*` →
 * defaults. Consumers go through these helpers; nothing reads either location
 * directly. Typed structurally so domain types and the API-encoder
 * `InstanceData` both pass.
 */

interface ReviewPhaseRules {
  reviews?: PhaseReviewSettings;
  proposals?: { review?: boolean };
}

/** Reviewing happens in this phase (`reviews.submit`, legacy `proposals.review`). */
export function isReviewPhase(phase: { rules?: ReviewPhaseRules }): boolean {
  return (
    phase.rules?.reviews?.submit ?? phase.rules?.proposals?.review ?? false
  );
}

/** Voting happens in this phase. */
export function isVotingPhase(phase: {
  rules?: { voting?: { submit?: boolean } };
}): boolean {
  return phase.rules?.voting?.submit ?? false;
}

/**
 * True when any phase enables voting — i.e. the process has (or had) a voting
 * phase. Used to gate voting-only surfaces such as the "My Ballot" results tab.
 */
export function hasVotingPhase(
  phases: readonly { rules?: { voting?: { submit?: boolean } } }[],
): boolean {
  return phases.some(isVotingPhase);
}

/** `PhaseReviewSettings` with defaults applied (`anonymousFeedback` has none). */
export type ReviewSettings = Required<
  Pick<
    PhaseReviewSettings,
    'submit' | 'policy' | 'scope' | 'allowRevisions' | 'openReviews'
  >
> & { anonymousFeedback: PhaseReviewSettings['anonymousFeedback'] };

/** Resolves review settings for `phaseId`; throws if the phase doesn't exist. */
export function getPhaseReviewSettings(
  instanceData: {
    config?: {
      reviewsPolicy?: ReviewsPolicy;
      reviewsAllowRevisions?: boolean;
      reviewsAnonymousFeedback?: boolean;
    };
    phases?: ReadonlyArray<{ phaseId: string; rules?: ReviewPhaseRules }>;
  },
  phaseId: string,
): ReviewSettings {
  const phase = assertInstancePhase({ instance: { instanceData }, phaseId });
  const reviews = phase.rules?.reviews;
  const config = instanceData.config;

  return {
    submit: isReviewPhase(phase),
    policy: reviews?.policy ?? config?.reviewsPolicy ?? DEFAULT_REVIEWS_POLICY,
    // Scope is phase-only (no legacy config counterpart), so it resolves from
    // the phase rules or the default.
    scope: reviews?.scope ?? DEFAULT_REVIEWS_SCOPE,
    allowRevisions:
      reviews?.allowRevisions ?? config?.reviewsAllowRevisions ?? true,
    anonymousFeedback:
      reviews?.anonymousFeedback ?? config?.reviewsAnonymousFeedback,
    // Open reviews is phase-only (no legacy config counterpart), like scope,
    // and defaults to false.
    openReviews: reviews?.openReviews ?? false,
  };
}
