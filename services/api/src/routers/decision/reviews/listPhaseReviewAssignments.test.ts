import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import {
  addProposalToCategory,
  createProposalReview,
  ensureProposalCategoryTerms,
} from '@op/test';
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

describe.concurrent('decision.listPhaseReviewAssignments', () => {
  it('returns the per-reviewer rollup for an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Rollup proposal ${task.id}`,
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

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.totalAssignments).toBe(1);
    expect(result.reviewers).toHaveLength(1);
    const rollup = result.reviewers[0];
    if (!rollup) {
      throw new Error('Expected a reviewer rollup for the seeded assignment');
    }
    expect(rollup.profile.id).toBe(context.defaultReviewer.profileId);
    expect(rollup.assignedCount).toBe(1);
    expect(rollup.submittedCount).toBe(1);
    expect(rollup.lastSubmittedAt).not.toBeNull();
    expect(rollup.assignments[0]?.proposalId).toBe(created.proposal.id);
    expect(rollup.assignments[0]?.author?.id).toBe(created.author.profileId);
    expect(rollup.assignments[0]?.submittedAt).not.toBeNull();
    expect(result.proposals.map((proposal) => proposal.id)).toContain(
      created.proposal.id,
    );
    expect(result.eligibleReviewers.map((reviewer) => reviewer.id)).toContain(
      context.defaultReviewer.profileId,
    );
  });

  it('hides assignments whose proposal was moderation-detached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Detached proposal ${task.id}`,
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

    // A CSAM verdict after the assignment was made.
    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    // No metadata, and no counts derived from the hidden row.
    expect(result.totalAssignments).toBe(0);
    expect(result.reviewers).toEqual([]);
    expect(result.proposals.map((proposal) => proposal.id)).not.toContain(
      created.proposal.id,
    );
  });

  it('carries proposal categories on both the assignments and the pool', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Categorized proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const label = `Transportation ${task.id}`;
    const [term] = await ensureProposalCategoryTerms([label]);
    if (!term) {
      throw new Error(`Fixture failed to create a taxonomy term for ${label}`);
    }
    const { taxonomyTermId } = term;
    await addProposalToCategory({
      proposalId: created.proposal.id,
      taxonomyTermId,
    });

    // Teardown asserts `taxonomy_terms` is empty; drop the link first so the
    // term delete can't trip the FK.
    onTestFinished(async () => {
      await db
        .delete(proposalCategories)
        .where(eq(proposalCategories.taxonomyTermId, taxonomyTermId));
      await db
        .delete(taxonomyTerms)
        .where(eq(taxonomyTerms.id, taxonomyTermId));
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(
      result.reviewers[0]?.assignments[0]?.categories.map((c) => c.label),
    ).toEqual([label]);
    expect(
      result.proposals
        .find((proposal) => proposal.id === created.proposal.id)
        ?.categories.map((c) => c.label),
    ).toEqual([label]);
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
      reviewerCaller.decision.listPhaseReviewAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a plain instance member', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const member = await testData.createInstanceMember(context);

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listPhaseReviewAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
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
      adminCaller.decision.listPhaseReviewAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('carries the budget and a description preview on assignment cards', async ({
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

    // Legacy HTML description — the no-fetch branch of the same preview
    // resolution the proposal list rows use.
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

    const result = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const assignment = result.reviewers[0]?.assignments[0];
    expect(assignment?.proposalId).toBe(created.proposal.id);
    expect(assignment?.budget).toEqual({ amount: 25000, currency: 'EUR' });
    expect(assignment?.previewText).toBe(
      'A shared garden for the whole block.',
    );
  });

  it('nulls the budget and preview for a proposal that has neither', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Bare proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await db
      .update(proposals)
      .set({ proposalData: { title: `Bare proposal ${task.id}` } })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const assignment = result.reviewers[0]?.assignments[0];
    expect(assignment?.proposalId).toBe(created.proposal.id);
    expect(assignment?.budget).toBeNull();
    expect(assignment?.previewText).toBeNull();
  });
});

describeDecisionAccessTierGating('decision.listPhaseReviewAssignments', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.listPhaseReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.listPhaseReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
      const result = await caller.decision.listPhaseReviewAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      });

      expect(result.totalAssignments).toBe(0);
      expect(result.reviewers).toEqual([]);
    },
  ),
});
