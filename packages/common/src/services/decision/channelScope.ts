import { db } from '@op/db/client';

import { type ChannelName, Channels } from '../../realtime/channels';

/**
 * Every channel a revision request, a cancel or a resubmission on this
 * proposal affects. A revision cycle is proposal-wide, not assignment-wide:
 * the author's sheet and the admin summary read the proposal, and every other
 * reviewer of the same proposal sees the request count and the new version, so
 * the fan-out covers all of the proposal's assignments, not only the one that
 * acted.
 */
export const getProposalRevisionChannels = async ({
  processInstanceId,
  proposalId,
}: {
  processInstanceId: string;
  proposalId: string;
}): Promise<Array<ChannelName>> => {
  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: { proposalId },
    columns: { id: true },
  });

  return [
    Channels.decisionProposal(processInstanceId, proposalId),
    Channels.reviewAssignments(processInstanceId),
    ...assignments.map((assignment) =>
      Channels.reviewAssignment(assignment.id),
    ),
  ];
};

/**
 * The same fan-out for a mutation that only knows one assignment (request,
 * cancel). Falls back to the acting assignment's own channel when the
 * assignment row is gone, so a caller never loses it.
 */
export const getAssignmentRevisionChannels = async (
  assignmentId: string,
): Promise<Array<ChannelName>> => {
  const assignment = await db.query.proposalReviewAssignments.findFirst({
    where: { id: assignmentId },
    columns: { proposalId: true, processInstanceId: true },
  });

  if (!assignment) {
    return [Channels.reviewAssignment(assignmentId)];
  }

  return getProposalRevisionChannels(assignment);
};
