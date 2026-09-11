import {
  type ProposalReviewRequest,
  ProposalReviewRequestState,
} from '@op/common/client';
import { describe, expect, it } from 'vitest';

import { getLatestProposalRevisionNote } from './proposalRevisionNotes';

describe('getLatestProposalRevisionNote', () => {
  it('returns null when no request carries an answer', () => {
    expect(
      getLatestProposalRevisionNote([
        request({ id: 'r1', respondedAt: null, responseComment: null }),
      ]),
    ).toBeNull();
  });

  it('keeps every request one resubmission answered together', () => {
    // This pins the regression. One resubmission writes each row separately,
    // so its `responded_at` values differ by milliseconds and a timestamp
    // grouping showed one of the three requests the note answered.
    const group = getLatestProposalRevisionNote([
      request({
        id: 'r1',
        respondedAt: '2026-09-08T10:00:00.000Z',
        respondedProposalHistoryId: 'h1',
      }),
      request({
        id: 'r2',
        respondedAt: '2026-09-08T10:00:00.002Z',
        respondedProposalHistoryId: 'h1',
      }),
      request({
        id: 'r3',
        respondedAt: '2026-09-08T10:00:00.004Z',
        respondedProposalHistoryId: 'h1',
      }),
    ]);

    expect(group?.requests.map((item) => item.id)).toEqual(['r1', 'r2', 'r3']);
    expect(group?.note.respondedAt).toBe('2026-09-08T10:00:00.004Z');
  });

  it('leaves an earlier resubmission out of the latest note', () => {
    const group = getLatestProposalRevisionNote([
      request({
        id: 'old',
        respondedAt: '2026-09-01T10:00:00.000Z',
        respondedProposalHistoryId: 'h1',
        responseComment: 'First pass',
      }),
      request({
        id: 'new',
        respondedAt: '2026-09-08T10:00:00.000Z',
        respondedProposalHistoryId: 'h2',
        responseComment: 'Second pass',
      }),
    ]);

    expect(group?.requests.map((item) => item.id)).toEqual(['new']);
    expect(group?.note.comment).toBe('Second pass');
  });

  it('groups rows without a history id by their timestamp', () => {
    const group = getLatestProposalRevisionNote([
      request({ id: 'a', respondedAt: '2026-09-08T10:00:00.000Z' }),
      request({ id: 'b', respondedAt: '2026-09-08T10:00:00.000Z' }),
      request({ id: 'c', respondedAt: '2026-09-01T10:00:00.000Z' }),
    ]);

    expect(group?.requests.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

function request(
  overrides: Partial<ProposalReviewRequest> & { id: string },
): ProposalReviewRequest {
  return {
    assignmentId: '00000000-0000-0000-0000-000000000001',
    state: ProposalReviewRequestState.RESUBMITTED,
    requestComment: 'Please add a budget line',
    responseComment: 'Added it',
    respondedProposalHistoryId: null,
    requestedAt: '2026-09-07T10:00:00.000Z',
    respondedAt: '2026-09-08T10:00:00.000Z',
    resolvedAt: null,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    ...overrides,
  };
}
