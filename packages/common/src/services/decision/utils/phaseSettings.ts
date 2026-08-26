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

/** `PhaseReviewSettings` with defaults applied. */
export type ReviewSettings = Required<
  Pick<
    PhaseReviewSettings,
    | 'submit'
    | 'policy'
    | 'scope'
    | 'allowRevisions'
    | 'anonymousFeedback'
    | 'openReviews'
  >
>;

interface ReviewSettingsInstanceData {
  config?: {
    reviewsPolicy?: ReviewsPolicy;
    reviewsAllowRevisions?: boolean;
    reviewsAnonymousFeedback?: boolean;
  };
  phases?: ReadonlyArray<{ phaseId: string; rules?: ReviewPhaseRules }>;
}

/** Resolves review settings for `phaseId`; throws if the phase doesn't exist. */
export function getPhaseReviewSettings(
  instanceData: ReviewSettingsInstanceData,
  phaseId: string,
): ReviewSettings {
  const phase = assertInstancePhase({ instance: { instanceData }, phaseId });
  return reviewSettingsFromPhase(instanceData.config, phase);
}

/**
 * Lenient `getPhaseReviewSettings` for read surfaces: an unresolved or
 * off-list phase falls back to config → defaults instead of throwing.
 */
export function resolveReviewSettings(
  instanceData: ReviewSettingsInstanceData,
  phaseId: string | undefined,
): ReviewSettings {
  const phase = phaseId
    ? instanceData.phases?.find((p) => p.phaseId === phaseId)
    : undefined;
  return reviewSettingsFromPhase(instanceData.config, phase);
}

function reviewSettingsFromPhase(
  config: ReviewSettingsInstanceData['config'],
  phase: { phaseId: string; rules?: ReviewPhaseRules } | undefined,
): ReviewSettings {
  const reviews = phase?.rules?.reviews;

  return {
    submit: phase ? isReviewPhase(phase) : false,
    policy: reviews?.policy ?? config?.reviewsPolicy ?? DEFAULT_REVIEWS_POLICY,
    // Scope is phase-only (no legacy config counterpart), so it resolves from
    // the phase rules or the default.
    scope: reviews?.scope ?? DEFAULT_REVIEWS_SCOPE,
    allowRevisions:
      reviews?.allowRevisions ?? config?.reviewsAllowRevisions ?? true,
    // Defaults on: the field rendered unconditionally before this was wired.
    anonymousFeedback:
      reviews?.anonymousFeedback ?? config?.reviewsAnonymousFeedback ?? true,
    // Phase-only (no legacy config counterpart), like scope.
    openReviews: reviews?.openReviews ?? false,
  };
}
