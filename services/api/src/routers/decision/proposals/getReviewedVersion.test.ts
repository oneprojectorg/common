import { ProposalReviewState } from '@op/db/schema';
import {
  createProposalReview,
  createReviewAssignment,
  getCurrentProposalHistoryId,
  reviseProposal,
} from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

/** A submitted review anchored to the proposal's current version. */
async function submitReviewAtCurrentVersion(opts: {
  assignmentId: string;
  proposalId: string;
}) {
  return createProposalReview({
    assignmentId: opts.assignmentId,
    state: ProposalReviewState.SUBMITTED,
    reviewData: { answers: { impact: 4 }, rationales: {} },
    submittedAt: new Date().toISOString(),
    reviewedProposalHistoryId: await getCurrentProposalHistoryId({
      proposalId: opts.proposalId,
    }),
  });
}

describe.concurrent('getReviewedVersion', () => {
  it('returns the version the review was written against after the proposal moves on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Reviewed title',
    });
    const review = await submitReviewAtCurrentVersion({
      assignmentId: created.assignment.id,
      proposalId: created.proposal.id,
    });

    await reviseProposal({
      proposalId: created.proposal.id,
      proposalData: { title: 'Rewritten title' },
    });

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewedVersion({
      reviewId: review.id,
    });

    expect(result.isCurrent).toBe(false);
    expect(result.proposal.id).toBe(created.proposal.id);
    // The fixture's collaboration doc is never version-stamped, so the older
    // snapshot's rich text cannot be rebuilt — the rest of it still comes back.
    expect(result.contentUnavailable).toBe(true);
    expect(result.proposal.documentContent).toBeUndefined();
    expect(result.proposal.proposalData.title).toBe('Reviewed title');
  });

  it('reports isCurrent when the review anchors to the proposal as it stands', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Unchanged title',
    });
    const review = await submitReviewAtCurrentVersion({
      assignmentId: created.assignment.id,
      proposalId: created.proposal.id,
    });

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewedVersion({
      reviewId: review.id,
    });

    expect(result.isCurrent).toBe(true);
    expect(result.proposal.proposalData.title).toBe('Unchanged title');
  });

  it('returns the live proposal when neither the review nor the assignment is anchored', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Unanchored title',
    });
    const secondReviewer = await testData.createReviewer(created.context);
    const unanchoredAssignment = await createReviewAssignment({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      assignedProposalHistoryId: null,
    });
    const review = await createProposalReview({
      assignmentId: unanchoredAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      submittedAt: new Date().toISOString(),
    });

    await reviseProposal({
      proposalId: created.proposal.id,
      proposalData: { title: 'Rewritten title' },
    });

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewedVersion({
      reviewId: review.id,
    });

    expect(result.isCurrent).toBe(true);
    expect(result.proposal.proposalData.title).toBe('Rewritten title');
  });

  it('rejects a review anchored to another proposal snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({ title: 'Own' });
    const foreign = await testData.createReviewAssignment({
      context: created.context,
      title: 'Foreign',
    });

    const review = await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      submittedAt: new Date().toISOString(),
      reviewedProposalHistoryId: await getCurrentProposalHistoryId({
        proposalId: foreign.proposal.id,
      }),
    });

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.getReviewedVersion({ reviewId: review.id }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects an instance member without review or admin access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const review = await submitReviewAtCurrentVersion({
      assignmentId: created.assignment.id,
      proposalId: created.proposal.id,
    });

    const member = await testData.createInstanceMember(created.context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.getReviewedVersion({ reviewId: review.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describeDecisionAccessTierGating('getReviewedVersion', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const created = await testData.createReviewAssignment();
      const review = await submitReviewAtCurrentVersion({
        assignmentId: created.assignment.id,
        proposalId: created.proposal.id,
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewedVersion({ reviewId: review.id }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const created = await testData.createReviewAssignment();
      const review = await submitReviewAtCurrentVersion({
        assignmentId: created.assignment.id,
        proposalId: created.proposal.id,
      });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewedVersion({ reviewId: review.id }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const created = await testData.createReviewAssignment();
      const review = await submitReviewAtCurrentVersion({
        assignmentId: created.assignment.id,
        proposalId: created.proposal.id,
      });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewedVersion({ reviewId: review.id }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const created = await testData.createReviewAssignment({
        title: 'Network caller reads the reviewed version',
      });
      const review = await submitReviewAtCurrentVersion({
        assignmentId: created.assignment.id,
        proposalId: created.proposal.id,
      });

      const caller = await callers.networkJwt(
        created.context.defaultReviewer.email,
      );

      const result = await caller.decision.getReviewedVersion({
        reviewId: review.id,
      });

      expect(result.proposal.id).toBe(created.proposal.id);
    },
  ),
});
