import type { ProposalReviewRequest } from '@op/common/client';

import type { ProposalRevisionNote } from './ReviewNotesPanel';

export interface ProposalRevisionNoteGroup {
  note: ProposalRevisionNote;
  /** The requests this one note answered. */
  requests: Array<ProposalReviewRequest>;
}

/**
 * The author's latest revision note and the requests it answered.
 *
 * One resubmission stamps the same `respondedAt` on every request it answers,
 * so an identical timestamp is what groups them. Swap this for the grouped
 * `listProposalRevisionNotes` read once `respondedProposalHistoryId` is exposed
 * on the request schema.
 */
export function getLatestProposalRevisionNote(
  requests: Array<ProposalReviewRequest>,
): ProposalRevisionNoteGroup | null {
  const answered = requests.filter(
    (request) => request.respondedAt !== null && request.responseComment,
  );

  const latestRespondedAt = answered.reduce<string | null>(
    (latest, request) =>
      latest === null || (request.respondedAt ?? '') > latest
        ? request.respondedAt
        : latest,
    null,
  );

  if (latestRespondedAt === null) {
    return null;
  }

  const group = answered.filter(
    (request) => request.respondedAt === latestRespondedAt,
  );

  const comment = group[0]?.responseComment;

  if (!comment) {
    return null;
  }

  return {
    note: { comment, respondedAt: latestRespondedAt },
    requests: group,
  };
}
