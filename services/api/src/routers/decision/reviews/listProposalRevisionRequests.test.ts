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

  it('returns the proposal revision requests for a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    // The `createReviewer` fixture grants profile admin on the instance.
    // This covers the admin path through the authz gate (distinct from the
    // non-admin reviewer case below).
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Admin View',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Revised copy available.',
    });

    const adminCaller = await createAuthenticatedCaller(created.reviewer.email);
    const result = await adminCaller.decision.listProposalRevisionRequests({
      proposalId: created.proposal.id,
      states: [ProposalReviewRequestState.RESUBMITTED],
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.proposal.id).toBe(created.proposal.id);
    expect(result.revisionRequests[0]?.revisionRequest.state).toBe(
      ProposalReviewRequestState.RESUBMITTED,
    );
  });

  it('returns the proposal revision requests for a non-admin reviewer with the REVIEW role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Non-admin Reviewer',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Non-admin reviewer should see this.',
    });

    // User with a custom Reviewer role (READ + REVIEW on decisions, no ADMIN)
    // on the instance — no assignment on this proposal. Per the new contract,
    // any user with REVIEW capability on the instance can see revision
    // requests for any proposal there.
    const reviewer = await testData.createInstanceReviewerWithRole(
      created.context,
    );

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    const result = await reviewerCaller.decision.listProposalRevisionRequests({
      proposalId: created.proposal.id,
    });

    expect(result.revisionRequests).toHaveLength(1);
    expect(result.revisionRequests[0]?.proposal.id).toBe(created.proposal.id);
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

  it('rejects callers with only member (non-reviewer, non-admin) access to the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Members Should Not See',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Private review feedback.',
    });

    // Member has READ on the decisions zone via instance profile access,
    // but is neither the author, a reviewer, nor a decision admin. Per the
    // docblock contract, revision requests should not leak to them.
    const member = await testData.createInstanceMember(created.context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listProposalRevisionRequests({
        proposalId: created.proposal.id,
      }),
    ).rejects.toThrow();
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
