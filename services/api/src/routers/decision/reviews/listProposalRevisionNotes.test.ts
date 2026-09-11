import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  proposalHistory,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createReviewAssignment, createRevisionRequest } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Clones the proposal's latest snapshot into a new `proposalHistory` row, so a
 * test can name a distinct resubmitted version. `respondedProposalHistoryId`
 * carries a foreign key, so an invented uuid would not insert.
 */
async function createProposalSnapshot(proposalId: string): Promise<string> {
  const latest = await db.query.proposalHistory.findFirst({
    where: { id: proposalId },
    orderBy: { historyCreatedAt: 'desc' },
  });

  if (!latest) {
    throw new Error(`No proposal history row for proposal: ${proposalId}`);
  }

  const {
    historyId: _historyId,
    historyCreatedAt: _createdAt,
    ...row
  } = latest;

  const [snapshot] = await db
    .insert(proposalHistory)
    .values(row)
    .returning({ historyId: proposalHistory.historyId });

  if (!snapshot) {
    throw new Error(`Failed to clone history row for proposal: ${proposalId}`);
  }

  return snapshot.historyId;
}

describe.concurrent('listProposalRevisionNotes', () => {
  it('groups every request answered by one resubmission into a single note', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'One Note Two Requests',
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    const secondReviewer = await testData.createReviewer(created.context);
    const secondAssignment = await createReviewAssignment({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      phaseId: 'review',
    });

    const respondedProposalHistoryId = await createProposalSnapshot(
      created.proposal.id,
    );
    const respondedAt = '2026-09-01T10:00:00.000Z';

    const first = await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Add a budget breakdown.',
      requestedAt: '2026-08-01T10:00:00.000Z',
      respondedProposalHistoryId,
      responseComment: 'Budget and timeline are both in now.',
      respondedAt,
    });
    const second = await createRevisionRequest({
      assignmentId: secondAssignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Add a timeline.',
      requestedAt: '2026-08-02T10:00:00.000Z',
      respondedProposalHistoryId,
      responseComment: 'Budget and timeline are both in now.',
      respondedAt,
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalRevisionNotes({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      respondedProposalHistoryId,
      responseComment: 'Budget and timeline are both in now.',
    });
    // Newest request first inside a note.
    expect(result.items[0]?.requests.map((request) => request.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('returns one note per resubmission, newest first', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Two Resubmissions',
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    const olderHistoryId = await createProposalSnapshot(created.proposal.id);
    const newerHistoryId = await createProposalSnapshot(created.proposal.id);

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'First round.',
      respondedProposalHistoryId: olderHistoryId,
      responseComment: 'First response.',
      respondedAt: '2026-09-01T10:00:00.000Z',
    });
    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Second round.',
      respondedProposalHistoryId: newerHistoryId,
      responseComment: 'Second response.',
      respondedAt: '2026-09-02T10:00:00.000Z',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalRevisionNotes({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      respondedProposalHistoryId: newerHistoryId,
      responseComment: 'Second response.',
    });
    expect(result.items[1]).toMatchObject({
      respondedProposalHistoryId: olderHistoryId,
      responseComment: 'First response.',
    });
  });

  it('excludes requests that are still open and rejects a plain instance member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Open Request',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Still waiting on the author.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalRevisionNotes({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(0);

    const member = await testData.createInstanceMember(created.context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listProposalRevisionNotes({
        proposalId: created.proposal.id,
      }),
    ).rejects.toThrow();
  });
});

describeAccessTierGating('listProposalRevisionNotes', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.decision.listProposalRevisionNotes({
        proposalId: crypto.randomUUID(),
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalRevisionNotes({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalRevisionNotes({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalRevisionNotes({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),
});
