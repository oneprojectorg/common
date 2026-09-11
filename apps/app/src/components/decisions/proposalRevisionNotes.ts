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
 * One resubmission stamps the same `respondedProposalHistoryId` on every
 * request it answers, which is what groups them — the same key the server-side
 * `listProposalRevisionNotes` groups on. Rows written before that column
 * existed carry a null id, so those still group by an identical `respondedAt`.
 */
export function getLatestProposalRevisionNote(
  requests: Array<ProposalReviewRequest>,
): ProposalRevisionNoteGroup | null {
  const answered = requests.filter(
    (request) => request.respondedAt !== null && request.responseComment,
  );

  const latest = answered.reduce<ProposalReviewRequest | null>(
    (newest, request) =>
      newest === null ||
      (request.respondedAt ?? '') > (newest.respondedAt ?? '')
        ? request
        : newest,
    null,
  );

  if (latest === null || latest.respondedAt === null) {
    return null;
  }

  const historyId = latest.respondedProposalHistoryId;

  const group =
    historyId === null
      ? answered.filter(
          (request) =>
            request.respondedProposalHistoryId === null &&
            request.respondedAt === latest.respondedAt,
        )
      : answered.filter(
          (request) => request.respondedProposalHistoryId === historyId,
        );

  const comment = group[0]?.responseComment;

  if (!comment) {
    return null;
  }

  return {
    note: { comment, respondedAt: latest.respondedAt },
    requests: group,
  };
}
