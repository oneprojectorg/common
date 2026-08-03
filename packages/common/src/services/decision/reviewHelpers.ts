import { db } from '@op/db/client';
import {
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import type { DecisionRolePermissions } from './permissions';
import { type ProposalData, parseProposalData } from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isPhaseAtOrBefore } from './utils/phaseOrder';
import { getPhaseReviewSettings } from './utils/phaseSettings';

/** Shared `with` config for review assignment queries. */
export const reviewAssignmentWithConfig = {
  assignedProposalHistory: {
    with: {
      submittedBy: {
        with: {
          avatarImage: true,
        },
      },
      profile: true,
    },
  },
  proposal: {
    with: {
      submittedBy: {
        with: {
          avatarImage: true,
        },
      },
      profile: true,
    },
  },
  reviews: true,
  requests: {
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
} as const;

/**
 * Shared `with` config for proposal queries that need to surface the
 * proposal's revision requests (author inbox + proposal-scoped views).
 * Optionally filters nested `requests` by state.
 */
export function proposalWithRevisionRequestsConfig(
  states?: ProposalReviewRequestState[],
) {
  const requestsWhere =
    states && states.length > 0 ? { state: { in: states } } : undefined;

  return {
    submittedBy: {
      with: {
        avatarImage: true,
      },
    },
    profile: true,
    processInstance: {
      columns: {},
      with: {
        profile: {
          columns: { slug: true as const },
        },
      },
    },
    reviewAssignments: {
      columns: { id: true as const },
      with: {
        requests: {
          where: requestsWhere,
          orderBy: {
            createdAt: 'desc' as const,
          },
        },
      },
    },
  } as const;
}

/**
 * A submitted review stays editable only while its assignment's phase is still
 * the instance's current phase. Once the instance advances past that phase,
 * downstream surfaces (score aggregates, results) are considered settled, so
 * edits are refused. This is the single predicate behind both the read-side
 * `canEditReview` signal and the `updateReview` service guard.
 */
export function canEditSubmittedReview({
  assignment,
  instance,
  review,
}: {
  assignment: { phaseId: string };
  instance: { currentStateId: string | null };
  // `state` is the raw enum column, which infers as `string`; compared against
  // the enum value (also a string) below.
  review: { state: string } | null;
}): boolean {
  return (
    review?.state === ProposalReviewState.SUBMITTED &&
    instance.currentStateId != null &&
    instance.currentStateId === assignment.phaseId
  );
}

/** Returns the active (REQUESTED) revision request, falling back to the most recent one. */
export function getActiveRevisionRequest(
  requests: ProposalReviewRequest[],
): ProposalReviewRequest | null {
  return (
    requests.find((r) => r.state === ProposalReviewRequestState.REQUESTED) ??
    requests[0] ??
    null
  );
}

/**
 * The slice of a loaded decision instance (`getInstance`'s return) that the
 * phase-reviews read gate needs: the viewer's resolved capabilities plus the
 * instance's phase configuration.
 */
export interface PhaseReviewsReadContext {
  access: DecisionRolePermissions;
  currentStateId: string | null;
  instanceData: DecisionInstanceData;
}

/**
 * Whether the caller may read a phase's submitted review set on this
 * instance. Admins always can — any phase, or all phases when `phaseId` is
 * omitted — and return before any phase-settings resolution (which throws
 * NotFound on a phase the instance doesn't have). Reviewers (`access.review`)
 * must name a phase — without one the caller would read reviews blended
 * across ALL phases — and that phase's resolved `openReviews` must be on. An
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

/** `canReadPhaseReviews`, but throws `UnauthorizedError` on denial. */
export function assertCanReadPhaseReviews(
  instance: PhaseReviewsReadContext,
  phaseId: string | undefined,
): void {
  if (!canReadPhaseReviews(instance, phaseId)) {
    throw new UnauthorizedError(
      "You don't have access to read reviews for this process instance",
    );
  }
}

/** Loads and authorizes access to a single review assignment for the current reviewer. */
export async function assertReviewAssignmentContext({
  assignmentId,
  user,
}: {
  assignmentId: string;
  user: User;
}) {
  const [assignment, dbUser] = await Promise.all([
    db.query.proposalReviewAssignments.findFirst({
      where: {
        id: assignmentId,
      },
      with: reviewAssignmentWithConfig,
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!assignment) {
    throw new NotFoundError('Review assignment', assignmentId);
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const instance = await getInstance({
    instanceId: assignment.processInstanceId,
    user,
  });

  // TODO: revisit the access here
  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  if (assignment.reviewerProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      "You don't have access to this review assignment",
    );
  }

  return {
    assignment,
    instance,
    review: assignment.reviews[0] ?? null,
    revisionRequest: getActiveRevisionRequest(assignment.requests),
    rubricTemplate: instance.instanceData.rubricTemplate ?? null,
  };
}

/**
 * Resolves the effective proposal snapshot from a review assignment
 * and parses/validates its proposal data.
 */
export function resolveAssignmentProposal(assignment: {
  assignedProposalHistory: {
    proposalData: unknown;
  } | null;
  proposal: {
    id: string;
    proposalData: unknown;
  };
}): {
  id: string;
  proposalData: ProposalData;
} {
  const snapshot = assignment.assignedProposalHistory ?? assignment.proposal;
  const id = assignment.proposal.id;

  const proposalData = parseProposalData(snapshot.proposalData);

  // Temporary: accept HTML-only proposals until local TipTap lands.
  if (!proposalData.collaborationDocId && !proposalData.description) {
    throw new ValidationError(`Proposal ${id} has no document content`);
  }

  // HTML-only proposals (no collaboration doc) are a supported legacy state —
  // the content check above already accepts them — so they aren't flagged here.
  // The only unexpected case is a proposal that has a collaboration doc but no
  // version stamp, meaning the best-effort version snapshot on submit (see
  // submitProposal) didn't take. That's non-fatal (the version is not the
  // source of truth for content), so warn rather than error.
  if (
    proposalData.collaborationDocId &&
    proposalData.collaborationDocVersionId == null
  ) {
    logger.warn('Proposal is missing collaborationDocVersionId', {
      proposalId: id,
    });
  }

  return { ...snapshot, id, proposalData };
}
