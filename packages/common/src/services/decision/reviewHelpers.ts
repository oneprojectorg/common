import { db } from '@op/db/client';
import {
  type ProposalReviewRequest,
  ProposalReviewRequestState,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { type ProposalData, parseProposalData } from './proposalDataSchema';

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
    throw new NotFoundError('Review assignment');
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

  if (
    !proposalData.collaborationDocId ||
    !proposalData.collaborationDocVersionId
  ) {
    console.error(
      `Proposal ${id} is missing collaborationDocId or collaborationDocVersionId`,
    );
  }

  return { ...snapshot, id, proposalData };
}
