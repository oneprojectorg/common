import { and, db, eq, isNull } from '@op/db/client';
import {
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import type { DecisionRolePermissions } from './permissions';
import { type ProposalData, parseProposalData } from './proposalDataSchema';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isInstanceCurrentPhase } from './utils/instance';
import { isPhaseAtOrBefore } from './utils/phaseOrder';
import { getPhaseReviewSettings } from './utils/phaseSettings';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

/** Shared `with` config for review assignment queries. */
export const reviewAssignmentWithConfig = {
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
 * Read gate shared by the proposal-scoped, reviewer-authored outputs
 * (revision requests, author feedback): the proposal's authors, decision
 * admins, and any user with the REVIEW capability on the instance. Other
 * participants — voters, plain members with READ — are rejected. `subject`
 * names the thing being read in the denial message.
 *
 * "Authors" is the proposal's own profile membership — the creator plus any
 * invited collaborators (`profileUsers` on `proposal.profileId`) — which is
 * the audience `getProposal` grants a draft/hidden/flagged proposal to and
 * `resolveProposalListScope` scopes the list to. `submittedByProfileId` alone
 * would miss co-authors, and misses the human behind an org-acting submitter
 * (the profile recorded there is whichever profile was active at submit time,
 * while the proposal-profile grant is keyed on the auth user). Kept as a union
 * of the two so no caller who could read these before loses access.
 * Fail-closed: no grant on the proposal profile means no author standing.
 */
export async function assertProposalReviewReadAccess({
  subject,
  instance,
  profileId,
  proposal,
  user,
}: {
  subject: string;
  instance: { access: Pick<DecisionRolePermissions, 'admin' | 'review'> };
  profileId: string;
  proposal: { profileId: string; submittedByProfileId: string | null };
  user: AccessUser | undefined;
}): Promise<void> {
  if (instance.access.admin || instance.access.review) {
    return;
  }

  if (proposal.submittedByProfileId === profileId) {
    return;
  }

  // Only reached for a caller with neither instance capability nor the
  // submitter profile — the co-author path.
  const proposalRoles = await getProfileAccessRoles({
    user,
    profileId: proposal.profileId,
  });

  if (proposalRoles.length > 0) {
    return;
  }

  throw new UnauthorizedError(
    `You don't have access to this proposal's ${subject}`,
  );
}

type ProposalWithConfig = NonNullable<
  NonNullable<Parameters<typeof db.query.proposals.findFirst>[0]>['with']
>;

/**
 * Shared preamble of the proposal-scoped reviewer-output reads: load the
 * proposal, resolve the caller, gate through
 * `assertProposalReviewReadAccess`. `with` shapes the returned proposal's
 * relations per caller; `subject` names the output in the denial message.
 */
export async function loadProposalForReviewRead<
  TWith extends ProposalWithConfig,
>({
  proposalId,
  subject,
  user,
  with: withConfig,
}: {
  proposalId: string;
  subject: string;
  user: User;
  with: TWith;
}) {
  // The proposal read doesn't depend on the caller's profile — resolve both at
  // once, as `assertReviewAssignmentContext` does.
  const [proposal, commonUser] = await Promise.all([
    db.query.proposals.findFirst({
      // Moderation-detached proposals return 404 — authors and reviewers alike
      // should not read reviewer output on a taken-down row.
      where: {
        RAW: (table) =>
          and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
      },
      with: withConfig,
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const instance = await getInstance({
    instanceId: proposal.processInstanceId,
    user,
  });

  await assertProposalReviewReadAccess({
    subject,
    instance,
    profileId: commonUser.profileId,
    proposal,
    user,
  });

  return { proposal, instance };
}

/**
 * A submitted review is editable only while its assignment's phase is still the
 * instance's current phase. Backs the read-side `canEditReview` signal; the
 * `updateReview` service re-checks against the live phase before writing.
 */
export function canEditSubmittedReview({
  assignment,
  instance,
  review,
}: {
  assignment: { phaseId: string };
  instance: { currentStateId: string | null };
  // Raw enum column infers as `string`.
  review: { state: string } | null;
}): boolean {
  return (
    review?.state === ProposalReviewState.SUBMITTED &&
    isInstanceCurrentPhase(instance, assignment.phaseId)
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

/**
 * Assignments deliberately survive a phase advance, so review writes and the
 * revision cycle must assert the assignment's phase is still current — admins
 * included. A cached instance may lag an advance by ~2 minutes; accepted.
 */
export function assertReviewAssignmentPhaseIsCurrent(
  instance: { currentStateId: string | null },
  phaseId: string,
): void {
  if (!isInstanceCurrentPhase(instance, phaseId)) {
    throw new ValidationError(
      'This review assignment can no longer be modified because the review phase has ended',
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
    // Reviews are validated and rendered against the rubric of the phase
    // their assignment belongs to.
    rubricTemplate: getPhaseRubricTemplate(
      instance.instanceData,
      assignment.phaseId,
    ),
  };
}

/**
 * Resolves the proposal a review assignment is about — always the LIVE
 * proposal, for every assignment status — and parses/validates its proposal
 * data. The assignment's `assignedProposalHistoryId` pin records the version
 * the reviewer last reviewed (see `isReviewOutOfDate`); it is deliberately not
 * used to pick the content shown, so a reviewer always reads what the author
 * has now.
 */
export function resolveAssignmentProposal(assignment: {
  proposal: {
    id: string;
    proposalData: unknown;
  };
}): {
  id: string;
  proposalData: ProposalData;
} {
  const snapshot = assignment.proposal;
  const id = snapshot.id;

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
