import {
  DEFAULT_REVIEWS_POLICY,
  DEFAULT_REVIEWS_SCOPE,
} from '../schemas/types';
import type { PhaseReviewSettings, ReviewsPolicy } from '../schemas/types';
import { isValidProcessBudget } from '../templateBudget';
import { assertInstancePhase } from './instance';
import { getPreviousPhases } from './phaseOrder';

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

/** Reviews in this phase are readable by other reviewers and by later phases. */
export function hasOpenReviews(phase: { rules?: ReviewPhaseRules }): boolean {
  return phase.rules?.reviews?.openReviews ?? false;
}

/**
 * Authors may edit their proposals after submitting them in this phase — the
 * Process Builder's "Proposal editing" toggle.
 */
export function canEditProposals(phase: {
  rules?: { proposals?: { edit?: boolean } };
}): boolean {
  return phase.rules?.proposals?.edit ?? false;
}

/** Voting happens in this phase. */
export function isVotingPhase(phase: {
  rules?: { voting?: { submit?: boolean } };
}): boolean {
  return phase.rules?.voting?.submit ?? false;
}

const DEFAULT_VOTER_COST_FIELD = 'budget';

export function getVoterCostField(phase: {
  rules?: { voting?: { voterCostField?: string } };
}): string {
  const voterCostField = phase.rules?.voting?.voterCostField?.trim();

  return voterCostField ? voterCostField : DEFAULT_VOTER_COST_FIELD;
}

// Invalid values mean no cap rather than an error.
export function getVoterBudget(phase: {
  rules?: { voting?: { voterBudget?: number } };
}): number | undefined {
  const voterBudget = phase.rules?.voting?.voterBudget;

  return isValidProcessBudget(voterBudget) ? voterBudget : undefined;
}

export function isRankedVoting(phase: {
  rules?: { voting?: { ranked?: boolean } };
}): boolean {
  return phase.rules?.voting?.ranked === true;
}

/**
 * Participants may comment during this phase — the Process Builder's
 * "Comments" toggle.
 *
 * Defaults to TRUE, unlike every sibling rule: phases configured before this
 * toggle existed carry no `comments` key and all of them allow commenting
 * today, so defaulting to false would retire commenting on every live process.
 */
export function allowsComments(phase: {
  rules?: { comments?: { submit?: boolean } };
}): boolean {
  return phase.rules?.comments?.submit ?? true;
}

/** Whether the instance's current phase takes comments. */
export function areCommentsAllowed({
  phases,
  currentPhaseId,
}: {
  phases: readonly {
    phaseId: string;
    rules?: { comments?: { submit?: boolean } };
  }[];
  currentPhaseId: string | null | undefined;
}): boolean {
  const phase = phases.find((p) => p.phaseId === currentPhaseId);

  // An unresolvable phase falls back to allowed rather than muting a process
  // whose phase list has not caught up.
  return phase ? allowsComments(phase) : true;
}

/** Whether an already-submitted proposal may still be edited. */
export function isPostSubmissionEditingAllowed({
  phases,
  currentPhaseId,
}: {
  phases: readonly {
    phaseId: string;
    rules?: { proposals?: { edit?: boolean } };
  }[];
  currentPhaseId: string | null | undefined;
}): boolean {
  return (
    phases.find((phase) => phase.phaseId === currentPhaseId)?.rules?.proposals
      ?.edit ?? false
  );
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

interface ReviewPhase {
  phaseId: string;
  rules?: ReviewPhaseRules;
}

interface ReviewSettingsInstanceData {
  config?: {
    reviewsPolicy?: ReviewsPolicy;
    reviewsAllowRevisions?: boolean;
    reviewsAnonymousFeedback?: boolean;
  };
  phases?: readonly ReviewPhase[];
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

export function getPreviousReviewPhases<Phase extends ReviewPhase>(
  instanceData: { phases?: readonly Phase[] },
  phaseId: string,
): Phase[] {
  return getPreviousPhases(instanceData, phaseId).filter(isReviewPhase);
}

function reviewSettingsFromPhase(
  config: ReviewSettingsInstanceData['config'],
  phase: ReviewPhase | undefined,
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
    openReviews: phase ? hasOpenReviews(phase) : false,
  };
}
