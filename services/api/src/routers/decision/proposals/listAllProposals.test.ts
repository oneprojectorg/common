import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithPipeline } from '../../../test/helpers/pipelineSchemas';
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

describe.concurrent('listAllProposals', () => {
  it('bypasses phase scoping to surface proposals not carried into the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Submit 3 proposals; the submission→review pipeline is limit(2).
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const phaseScoped = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(phaseScoped.proposals).toHaveLength(2);

    const allValid = await caller.decision.listAllProposals({
      processInstanceId: instanceId,
    });
    expect(allValid.items).toHaveLength(3);
    expect(allValid.next).toBeNull();
  });

  it('excludes REJECTED and DUPLICATE proposals for non-admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [submitted, approved, rejected, duplicate, selected] =
      await Promise.all([
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Submitted ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Approved ${task.id}` },
          status: ProposalStatus.APPROVED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Rejected ${task.id}` },
          status: ProposalStatus.REJECTED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Duplicate ${task.id}` },
          status: ProposalStatus.DUPLICATE,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Selected ${task.id}` },
          status: ProposalStatus.SELECTED,
        }),
      ]);

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([submitted.id, approved.id, selected.id]),
    );
    expect(ids).not.toContain(rejected.id);
    expect(ids).not.toContain(duplicate.id);
    expect(result.items).toHaveLength(3);
  });

  it('excludes REJECTED and DUPLICATE proposals for admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const [submitted, rejected, duplicate] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Submitted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Rejected ${task.id}` },
        status: ProposalStatus.REJECTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Duplicate ${task.id}` },
        status: ProposalStatus.DUPLICATE,
      }),
    ]);

    const result = await adminCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(submitted.id);
    expect(ids).not.toContain(rejected.id);
    expect(ids).not.toContain(duplicate.id);
    expect(result.items).toHaveLength(1);
  });

  it('excludes DRAFT proposals', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [draft, submitted] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Draft ${task.id}` },
        // default status is DRAFT
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Submitted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    const result = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(submitted.id);
    expect(ids).not.toContain(draft.id);
  });

  it('excludes soft-deleted proposals', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [active, deleted] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Active ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Deleted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, deleted.id));

    const result = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(deleted.id);
    expect(result.items).toHaveLength(1);
  });

  it('hides HIDDEN proposals from all viewers, including admins', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const [visible, hidden] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Visible ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Hidden ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await adminCaller.decision.updateProposal({
      proposalId: hidden.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const memberResult = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });
    expect(memberResult.items.map((p) => p.id)).toEqual([visible.id]);

    const adminResult = await adminCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });
    expect(adminResult.items.map((p) => p.id)).toEqual([visible.id]);
    expect(adminResult.items).toHaveLength(1);
  });

  it('paginates proposals filtered by category with a cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const termId = randomUUID();
    await db.insert(taxonomyTerms).values({
      id: termId,
      termUri: `category-${termId}`,
      label: `Category ${task.id}`,
    });
    // proposalCategories cascades on taxonomyTerms delete, so cleaning up the
    // term cleans up the join rows too.
    onTestFinished(async () => {
      await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, termId));
    });

    // Create 5 proposals in the category serially so each gets a distinct
    // createdAt — cursor pagination orders by createdAt without a tie-breaker.
    const inCategory: Array<{ id: string }> = [];
    for (let i = 0; i < 5; i++) {
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `In-category ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
      await db
        .insert(proposalCategories)
        .values({ proposalId: proposal.id, taxonomyTermId: termId });
      inCategory.push(proposal);
    }

    // Two proposals outside the category — must never appear in results.
    const [outOne, outTwo] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Out 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Out 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    const page1 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.next).not.toBeNull();

    const page2 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
      cursor: page1.next,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.next).not.toBeNull();

    const page3 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
      cursor: page2.next,
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.next).toBeNull();

    const returnedIds = [
      ...page1.items.map((p) => p.id),
      ...page2.items.map((p) => p.id),
      ...page3.items.map((p) => p.id),
    ];
    expect(new Set(returnedIds).size).toBe(5);
    for (const proposal of inCategory) {
      expect(returnedIds).toContain(proposal.id);
    }
    expect(returnedIds).not.toContain(outOne.id);
    expect(returnedIds).not.toContain(outTwo.id);
  });
});
