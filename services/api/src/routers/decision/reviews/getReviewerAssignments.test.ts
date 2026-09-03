import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
  proposals,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
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

describe.concurrent('decision.getReviewerAssignments', () => {
  it('returns the reviewer header, totals and their own assignment cards', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Scoped proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    // The header subtitle reads the profile's contact email, which the
    // fixture leaves unset.
    await db
      .update(profiles)
      .set({ email: `reviewer-${task.id}@example.org` })
      .where(eq(profiles.id, context.defaultReviewer.profileId));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.reviewer?.id).toBe(context.defaultReviewer.profileId);
    expect(result.reviewer?.email).toBe(`reviewer-${task.id}@example.org`);
    expect(result.assignedCount).toBe(1);
    expect(result.submittedCount).toBe(1);
    expect(result.lastSubmittedAt).not.toBeNull();
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.proposalId).toBe(created.proposal.id);
    expect(result.assignments[0]?.author?.id).toBe(created.author.profileId);
  });

  it('excludes other reviewers assignments from the scoped queue', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Shared proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const other = await testData.createInstanceReviewerWithRole(context);
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    await adminCaller.decision.assignReviews({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
      proposalIds: [created.proposal.id],
    });

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
    });

    // Both reviewers hold the same proposal; the scoped read returns one row.
    expect(result.assignedCount).toBe(1);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.proposalId).toBe(created.proposal.id);
    expect(result.reviewer?.id).toBe(other.profileId);
  });

  it('counts reviews by every reviewer in reviewedCount, not just this one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Tallied proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const other = await testData.createInstanceReviewerWithRole(context);
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    await adminCaller.decision.assignReviews({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
      proposalIds: [created.proposal.id],
    });

    // Only the OTHER reviewer submits. The scoped reviewer has submitted
    // nothing, so a JS tally over their own rows would report 0.
    const otherAssignment = await db.query.proposalReviewAssignments.findFirst({
      where: {
        proposalId: created.proposal.id,
        reviewerProfileId: other.profileId,
      },
    });
    if (!otherAssignment) {
      throw new Error('Fixture failed to assign the second reviewer');
    }
    await createProposalReview({
      assignmentId: otherAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.submittedCount).toBe(0);
    expect(result.assignments[0]?.reviewedCount).toBe(1);
  });

  it('resolves the preview text and budget for the cards', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Budgeted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: `Budgeted proposal ${task.id}`,
          description: '<p>A shared garden for the whole block.</p>',
          budget: { amount: 25000, currency: 'EUR' },
        },
      })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.assignments[0]?.previewText).toBe(
      'A shared garden for the whole block.',
    );
    expect(result.assignments[0]?.budget).toEqual({
      amount: 25000,
      currency: 'EUR',
    });
  });

  it('hides assignments whose proposal was moderation-detached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Detached proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.assignedCount).toBe(0);
    expect(result.assignments).toEqual([]);
  });

  it('withholds the identity of a profile with no tie to the process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    // A real profile elsewhere on the platform: an admin who can guess a UUID
    // must not be able to read back its name or email.
    const outsider = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: outsider.defaultReviewer.profileId,
    });

    // The screen renders its own "not in this phase" empty state from this,
    // rather than treating a dead link as a server error.
    expect(result.reviewer).toBeNull();
    expect(result.isEligible).toBe(false);
    expect(result.assignments).toEqual([]);
  });

  it('keeps the identity of a reviewer who lost the role but kept history', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Frozen queue proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    // Association is assignments OR eligibility, so history alone is enough.
    expect(result.reviewer?.id).toBe(context.defaultReviewer.profileId);
    expect(result.assignments).toHaveLength(1);
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.getReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
        reviewerProfileId: context.defaultReviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeDecisionAccessTierGating('decision.getReviewerAssignments', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      // The admin: assert it lands, since "not Unauthorized" would also pass
      // if the procedure never ran.
      const result = await caller.decision.getReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: context.defaultReviewer.profileId,
      });

      expect(result.assignedCount).toBe(0);
      expect(result.assignments).toEqual([]);
    },
  ),
});
