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

describe.concurrent('listProposalsRevisionRequests', () => {
  it('returns pending revision requests for the proposal author', async ({
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
    const result = await authorCaller.decision.listProposalsRevisionRequests(
      {},
    );

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]).toMatchObject({
      revisionRequest: {
        id: revisionRequest.id,
        assignmentId: created.assignment.id,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment: 'Please add a detailed budget breakdown.',
      },
      proposal: {
        id: created.proposal.id,
        processInstanceId: created.context.instance.instance.id,
        profileId: created.proposal.profileId,
      },
    });
    expect(result.revisionRequests[0]?.proposal.proposalData.title).toBe(
      'Budget Proposal',
    );
    expect(result.revisionRequests[0]?.decisionProfileSlug).toBeTruthy();
  });

  it('filters by proposalId when provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: 'First Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const second = await testData.createReviewAssignment({
      context: first.context,
      author: first.author,
      title: 'Second Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await Promise.all([
      createRevisionRequest({
        assignmentId: first.assignment.id,
        requestComment: 'Fix first proposal',
      }),
      createRevisionRequest({
        assignmentId: second.assignment.id,
        requestComment: 'Fix second proposal',
      }),
    ]);

    const authorCaller = await createAuthenticatedCaller(first.author.email);
    const result = await authorCaller.decision.listProposalsRevisionRequests({
      proposalId: first.proposal.id,
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.proposal.id).toBe(first.proposal.id);
    expect(result.revisionRequests[0]?.proposal.proposalData.title).toBe(
      'First Proposal',
    );
  });

  it('returns empty list when no revision requests exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Revisions Needed',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalsRevisionRequests(
      {},
    );

    expect(result.revisionRequests).toHaveLength(0);
  });

  it('excludes cancelled and resolved revision requests', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Mixed States',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    // Create a revision request then cancel it via the reviewer
    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const request = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Will be cancelled',
    });

    await reviewerCaller.decision.cancelRevisionRequest({
      assignmentId: created.assignment.id,
      revisionRequestId: request.id,
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalsRevisionRequests(
      {},
    );

    expect(result.revisionRequests).toHaveLength(0);
  });

  it('does not return revision requests for proposals by other authors', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Not My Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    // A different author should see nothing
    const otherAuthor = await testData.createReviewAssignment({
      context: created.context,
      title: 'Other Proposal',
    });

    const otherCaller = await createAuthenticatedCaller(
      otherAuthor.author.email,
    );
    const result = await otherCaller.decision.listProposalsRevisionRequests({});

    // Should only see their own proposals (which have no revision requests)
    expect(result.revisionRequests).toHaveLength(0);
  });
});
