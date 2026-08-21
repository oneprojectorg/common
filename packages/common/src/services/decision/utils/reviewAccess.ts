import { isPhaseAtOrBefore } from './phaseOrder';
import { getPhaseReviewSettings } from './phaseSettings';

/**
 * The slice of a loaded decision instance that the phase-reviews read gate
 * needs: the viewer's resolved capabilities plus the instance's phase
 * configuration. Structural like the phase helpers, so domain instance data
 * and the API-encoder shape both pass — the endpoint enforcing the gate and a
 * client surface deciding whether to fetch run the same predicate.
 * Client-safe: no server-only imports.
 */
export interface PhaseReviewsReadContext {
  access: { admin: boolean; review: boolean };
  currentStateId: string | null;
  instanceData: Parameters<typeof getPhaseReviewSettings>[0];
}

/**
 * Whether the caller may read a phase's submitted review set on this
 * instance. Admins always can — any phase, or the caller's default when
 * `phaseId` is omitted — and return before any phase-settings resolution
 * (which throws NotFound on a phase the instance doesn't have). Reviewers
 * (`access.review`) must name a phase, and that phase's resolved
 * `openReviews` must be on. An
 * open phase stays readable after it ends (later-phase reviewers read the
 * earlier phase's reviews), but phases after the current one are never
 * readable. The reviewer grant is deliberately process-wide: ANY reviewer of
 * the process can read, not only those assigned to a given proposal.
 */
export function canReadPhaseReviews(
  instance: PhaseReviewsReadContext,
  phaseId: string | undefined,
): boolean {
  if (instance.access.admin) {
    return true;
  }

  if (!instance.access.review || !phaseId || instance.currentStateId == null) {
    return false;
  }

  // No peeking past the current phase: the target must be the current phase
  // or an earlier one in the instance's phase ordering.
  if (
    !isPhaseAtOrBefore(instance.instanceData, phaseId, instance.currentStateId)
  ) {
    return false;
  }

  return getPhaseReviewSettings(instance.instanceData, phaseId).openReviews;
}
