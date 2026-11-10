import { and, db, eq, exists, inArray } from '@op/db/client';
import {
  type ProposalReviewRequestState,
  processInstances,
  proposalReviewAssignments,
  proposalReviewRequests,
  proposals as proposalsTable,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { notSuperseded } from './proposalSupersession';
import { proposalWithRevisionRequestsConfig } from './reviewHelpers';

/**
 * Author's inbox: revision requests across every proposal the caller
 * submitted. Scoped by identity (submittedByProfileId), not by instance
 * access — a user sees their own revisions regardless of decision.
 *
 * For the proposal-scoped view (one proposal, anyone with instance
 * access), use listProposalRevisionRequests.
 */
export async function listProposalsRevisionRequests({
  states,
  user,
}: {
  states?: ProposalReviewRequestState[];
  user: User;
}) {
  const commonUser = await assertUserByAuthId(user.id);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const revisionRequestsConfig = proposalWithRevisionRequestsConfig(states);

  const proposals = await db.query.proposals.findMany({
    where: {
      submittedByProfileId: commonUser.profileId,
      // A merged-away proposal is out of the review process, so its author has
      // nothing left to action.
      RAW: (table) =>
        and(
          notSuperseded({
            proposalId: table.id,
            processInstanceId: table.processInstanceId,
          }),
          exists(
            db
              .select({ id: proposalReviewRequests.id })
              .from(proposalReviewRequests)
              .innerJoin(
                proposalReviewAssignments,
                eq(
                  proposalReviewAssignments.id,
                  proposalReviewRequests.assignmentId,
                ),
              )
              .where(
                and(
                  eq(proposalReviewAssignments.proposalId, table.id),
                  eq(
                    proposalReviewAssignments.phaseId,
                    db
                      .select({
                        currentStateId: processInstances.currentStateId,
                      })
                      .from(processInstances)
                      .where(eq(processInstances.id, table.processInstanceId)),
                  ),
                  states && states.length > 0
                    ? inArray(proposalReviewRequests.state, states)
                    : undefined,
                ),
              ),
          ),
        )!,
    },
    with: {
      ...revisionRequestsConfig,
      reviewAssignments: {
        ...revisionRequestsConfig.reviewAssignments,
        // Only the current phase's requests can be answered; once the process
        // advances, older ones stay open but are no longer actionable.
        where: {
          RAW: (table) =>
            eq(
              table.phaseId,
              db
                .select({ currentStateId: processInstances.currentStateId })
                .from(processInstances)
                .where(eq(processInstances.id, table.processInstanceId)),
            ),
        },
      },
    },
  });

  const revisionRequests = proposals.flatMap((proposal) => {
    const decisionProfileSlug = proposal.processInstance.profile?.slug ?? '';

    return proposal.reviewAssignments.flatMap((assignment) =>
      assignment.requests.map((request) => ({
        revisionRequest: request,
        proposal,
        decisionProfileSlug,
      })),
    );
  });

  const instanceRows = await db
    .selectDistinct({ processInstanceId: proposalsTable.processInstanceId })
    .from(proposalsTable)
    .where(
      and(
        eq(proposalsTable.submittedByProfileId, commonUser.profileId),
        notSuperseded({
          proposalId: proposalsTable.id,
          processInstanceId: proposalsTable.processInstanceId,
        }),
      ),
    );

  const processInstanceIds = instanceRows.map((row) => row.processInstanceId);

  return { items: revisionRequests, processInstanceIds };
}
