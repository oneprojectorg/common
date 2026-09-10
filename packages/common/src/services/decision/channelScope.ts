import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { type ChannelName, Channels } from '../../realtime/channels';

/**
 * Every channel a revision request, a cancel or a resubmission on this
 * proposal affects. A revision cycle is proposal-wide, not assignment-wide:
 * the author's sheet and the admin summary read the proposal, and every other
 * reviewer of the same proposal sees the request count and the new version, so
 * the fan-out covers all of the proposal's assignments, not only the one that
 * acted.
 *
 * The lookup runs after the write has committed, so it degrades rather than
 * throws: a failed fan-out costs the per-assignment invalidations, while
 * throwing would report a successful mutation as failed.
 */
export const getProposalRevisionChannels = async ({
  processInstanceId,
  proposalId,
}: {
  processInstanceId: string;
  proposalId: string;
}): Promise<Array<ChannelName>> => {
  const known: Array<ChannelName> = [
    Channels.decisionProposal(processInstanceId, proposalId),
    Channels.reviewAssignments(processInstanceId),
  ];

  try {
    const assignments = await db.query.proposalReviewAssignments.findMany({
      where: { proposalId },
      columns: { id: true },
    });

    return [
      ...known,
      ...assignments.map((assignment) =>
        Channels.reviewAssignment(assignment.id),
      ),
    ];
  } catch (error) {
    logger.warn('Revision channel fan-out lookup failed', {
      error,
      processInstanceId,
      proposalId,
    });

    return known;
  }
};

/**
 * The same fan-out for a mutation that only knows one assignment (request,
 * cancel). Falls back to the acting assignment's own channels when the
 * proposal cannot be resolved, so a caller never loses them.
 */
export const getAssignmentRevisionChannels = async ({
  assignmentId,
  processInstanceId,
}: {
  assignmentId: string;
  processInstanceId: string;
}): Promise<Array<ChannelName>> => {
  const known: Array<ChannelName> = [
    Channels.reviewAssignment(assignmentId),
    Channels.reviewAssignments(processInstanceId),
  ];

  try {
    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
      columns: { proposalId: true },
    });

    if (!assignment) {
      return known;
    }

    const channels = await getProposalRevisionChannels({
      processInstanceId,
      proposalId: assignment.proposalId,
    });

    return [...new Set([...channels, ...known])];
  } catch (error) {
    logger.warn('Revision channel fan-out lookup failed', {
      error,
      assignmentId,
      processInstanceId,
    });

    return known;
  }
};
