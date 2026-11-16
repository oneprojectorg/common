import {
  TestDecisionsDataManager,
  addProposalToCategory,
  createDevelopProposalsMember,
  ensureProposalCategoryTerms,
  testDevelopSchema,
} from '@op/common/testing';
import { db, eq, inArray, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  processInstances,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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
 * A develop phase ("final") after "initial", in an instance with two
 * categories: "first" holds two origins, "second" one origin, and a third
 * origin has no category.
 */
async function createCategoriesSetup({
  testData,
  taskId,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  taskId: string;
  onTestFinished: (fn: () => Promise<void>) => void;
}) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: testDevelopSchema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;

  // Alphanumeric only, so the test helper and the production slug agree on
  // each label's term.
  const suffix = taskId.replace(/[^a-z0-9]/gi, '');
  const labels = [`first ${suffix}`, `second ${suffix}`];
  const [first, second] = await ensureProposalCategoryTerms(labels);
  if (!first || !second) {
    throw new Error('Failed to create the categories');
  }
  const termIds = [first.taxonomyTermId, second.taxonomyTermId];
  onTestFinished(async () => {
    await db
      .delete(proposalCategories)
      .where(inArray(proposalCategories.taxonomyTermId, termIds));
    await db.delete(taxonomyTerms).where(inArray(taxonomyTerms.id, termIds));
  });
  await setInstanceCategories({ instanceId, labels });

  const createOrigin = (title: string) =>
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title },
      status: ProposalStatus.SUBMITTED,
    });
  const [firstA, firstB, secondA] = await Promise.all([
    createOrigin('First A'),
    createOrigin('First B'),
    createOrigin('Second A'),
    createOrigin('No category'),
  ]);
  if (!firstA || !firstB || !secondA) {
    throw new Error('Failed to create the origins');
  }
  await Promise.all([
    addProposalToCategory({
      proposalId: firstA.id,
      taxonomyTermId: first.taxonomyTermId,
    }),
    addProposalToCategory({
      proposalId: firstB.id,
      taxonomyTermId: first.taxonomyTermId,
    }),
    addProposalToCategory({
      proposalId: secondA.id,
      taxonomyTermId: second.taxonomyTermId,
    }),
  ]);
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'initial',
    toPhaseId: 'final',
  });

  return {
    setup,
    instanceId,
    origins: { firstA, firstB, secondA },
    categories: { first, second },
  };
}

/** Writes the instance's category config, which names its categories. */
async function setInstanceCategories({
  instanceId,
  labels,
}: {
  instanceId: string;
  labels: string[];
}) {
  const categories = JSON.stringify(
    labels.map((label) => ({ id: label, label, description: '' })),
  );
  const instanceData = processInstances.instanceData;

  await db
    .update(processInstances)
    .set({
      instanceData: sql`${instanceData} || jsonb_build_object('config', coalesce(${instanceData}->'config', '{}'::jsonb) || jsonb_build_object('categories', ${categories}::jsonb))`,
    })
    .where(eq(processInstances.id, instanceId));
}

describe.concurrent('listDevelopCategoryTotals', () => {
  it("counts each category's origins and ready entries for an admin", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, origins, categories } =
      await createCategoriesSetup({
        testData,
        taskId: task.id,
        onTestFinished,
      });
    const member = await createDevelopProposalsMember({
      testData,
      setup,
      assignedOriginIds: [origins.firstA.id, origins.firstB.id],
    });
    const [memberCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(member.email),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const createEntry = async (sourceId: string, title: string) => {
      const entry = await memberCaller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [sourceId],
        proposalData: { title },
      });
      testData.trackProfileForCleanup(entry.profileId);
      return entry;
    };
    const ready = await createEntry(origins.firstA.id, 'Ready');
    const draft = await createEntry(origins.firstB.id, 'Draft');
    await memberCaller.decision.submitDevelopedProposal({
      proposalId: ready.id,
    });
    await Promise.all(
      [ready, draft].map((entry) =>
        addProposalToCategory({
          proposalId: entry.id,
          taxonomyTermId: categories.first.taxonomyTermId,
        }),
      ),
    );

    const { items } = await adminCaller.decision.listDevelopCategoryTotals({
      processInstanceId: instanceId,
    });

    // A draft is not ready, so only one entry counts.
    expect(items).toEqual([
      {
        id: categories.first.taxonomyTermId,
        name: categories.first.label,
        originsTotal: 2,
        readyEntriesTotal: 1,
      },
      {
        id: categories.second.taxonomyTermId,
        name: categories.second.label,
        originsTotal: 1,
        readyEntriesTotal: 0,
      },
    ]);
  });

  it('refuses a develop holder who is not an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createCategoriesSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const member = await createDevelopProposalsMember({ testData, setup });
    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.decision.listDevelopCategoryTotals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
