import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { createRevisionRequest } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
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

describe.concurrent('listProposalRevisionRequests', () => {
  it('returns the proposal revision requests for the author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Budget Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please add a detailed budget breakdown.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalRevisionRequests({
      proposalId: created.proposal.id,
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.revisionRequest.id).toBe(
      revisionRequest.id,
    );
    expect(result.revisionRequests[0]?.proposal.id).toBe(created.proposal.id);
  });

  it('returns the proposal revision requests for a reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Reviewer View',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Revised copy available.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listProposalRevisionRequests({
      proposalId: created.proposal.id,
      states: [ProposalReviewRequestState.RESUBMITTED],
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.proposal.id).toBe(created.proposal.id);
    expect(result.revisionRequests[0]?.revisionRequest.state).toBe(
      ProposalReviewRequestState.RESUBMITTED,
    );
  });

  it('filters by state', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'State Filter',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Pending.',
    });
    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Submitted.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalRevisionRequests({
      proposalId: created.proposal.id,
      states: [ProposalReviewRequestState.RESUBMITTED],
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.revisionRequest.state).toBe(
      ProposalReviewRequestState.RESUBMITTED,
    );
  });

  it('rejects callers without access to the proposal instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Outsider Cannot See',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Outsider, go away.',
    });

    // A fresh context in a different org — the caller has no relationship
    // to the target instance.
    const outsider = await testData.createReviewAssignment({
      title: 'Outsider Proposal',
    });

    const outsiderCaller = await createAuthenticatedCaller(
      outsider.author.email,
    );

    await expect(
      outsiderCaller.decision.listProposalRevisionRequests({
        proposalId: created.proposal.id,
      }),
    ).rejects.toThrow();
  });
});
