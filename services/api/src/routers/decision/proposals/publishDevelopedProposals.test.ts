import { getInstancePhases } from '@op/common';
import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  syncPhaseRows,
} from '@op/common/testing';
import { db, desc, eq } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  createCategoryDevelopReviewer,
  createCategoryDevelopSetup,
} from '../../../test/helpers/categoryDevelopTestUtils';
import { seedTwoCategories } from '../../../test/helpers/categoryTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

const unauthorized = { cause: { name: 'UnauthorizedError' } };
const invalid = { cause: { name: 'ValidationError' } };
const conflict = { cause: { name: 'ConflictError' } };

describe.concurrent('publishDevelopedProposals', () => {
  it('refuses a caller who is not an admin, and a Develop Proposals holder', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const [member, developer] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      createReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      }),
    ]);
    await developer.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    for (const caller of [memberCaller, developer.caller]) {
      await expect(
        caller.decision.publishDevelopedProposals({
          processInstanceId: instanceId,
        }),
      ).rejects.toMatchObject(unauthorized);
    }
  });

  it('refuses outside a develop phase', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
      advance: false,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.publishDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(invalid);
  });

  it('refuses when the phase has no category reviewer row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.publishDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(invalid);
  });

  it('refuses while one category reviewer row is not confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const [confirmed] = await Promise.all([
      createReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      }),
      createReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termB.id, phaseId: 'final' }],
      }),
    ]);
    await confirmed.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.publishDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(invalid);
  });

  it('makes the advanced entries visible and confirms the selections of the phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const draft = await createEntry({
      testData,
      caller: reviewer.caller,
      instanceId,
      source,
    });
    const advanced = await createEntry({
      testData,
      caller: reviewer.caller,
      instanceId,
      source,
    });
    await reviewer.caller.decision.submitDevelopedProposal({
      proposalId: advanced.id,
    });
    const notDeveloped = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Not developed' },
      status: ProposalStatus.SUBMITTED,
    });
    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, notDeveloped.id));
    await reviewer.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.publishDevelopedProposals({
      processInstanceId: instanceId,
    });

    expect(result).toEqual({ publishedCount: 1 });

    const rows = await db.query.proposals.findMany({
      where: { id: { in: [draft.id, advanced.id, notDeveloped.id] } },
      columns: { id: true, status: true, visibility: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(advanced.id)).toMatchObject({
      status: ProposalStatus.SUBMITTED,
      visibility: Visibility.VISIBLE,
    });
    expect(byId.get(draft.id)).toMatchObject({
      status: ProposalStatus.DRAFT,
      visibility: Visibility.HIDDEN,
    });
    expect(byId.get(notDeveloped.id)).toMatchObject({
      status: ProposalStatus.SUBMITTED,
      visibility: Visibility.HIDDEN,
    });

    const [attached, latestTransition, admin] = await Promise.all([
      db
        .select({ proposalId: decisionTransitionProposals.proposalId })
        .from(decisionTransitionProposals)
        .where(eq(decisionTransitionProposals.processInstanceId, instanceId)),
      db.query.stateTransitionHistory.findFirst({
        where: { processInstanceId: instanceId },
        orderBy: { transitionedAt: 'desc' },
        columns: { toStateId: true, transitionData: true },
      }),
      db.query.users.findFirst({
        where: { authUserId: setup.user.id },
        columns: { profileId: true },
      }),
    ]);
    expect(attached).toHaveLength(0);
    expect(latestTransition?.toStateId).toBe('final');
    expect(latestTransition?.transitionData).toMatchObject({
      manualSelection: {
        byProfileId: admin?.profileId,
        at: expect.any(String),
      },
    });

    const instance = await adminCaller.decision.getInstance({
      instanceId,
    });
    expect(instance.selectionsAreConfirmed).toBe(true);
  });

  it('replaces a pipeline selection held for approval', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const advanced = await createEntry({
      testData,
      caller: reviewer.caller,
      instanceId,
      source,
    });
    await reviewer.caller.decision.submitDevelopedProposal({
      proposalId: advanced.id,
    });
    await holdPipelineSelection({ instanceId, proposalId: source.id });
    // A held selection leaves the develop window open.
    await reviewer.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.publishDevelopedProposals({
      processInstanceId: instanceId,
    });

    expect(result).toEqual({ publishedCount: 1 });
    const [attached, latestTransition] = await Promise.all([
      db
        .select({ proposalId: decisionTransitionProposals.proposalId })
        .from(decisionTransitionProposals)
        .where(eq(decisionTransitionProposals.processInstanceId, instanceId)),
      db.query.stateTransitionHistory.findFirst({
        where: { processInstanceId: instanceId },
        orderBy: { transitionedAt: 'desc' },
        columns: { selectionConfirmedAt: true, transitionData: true },
      }),
    ]);
    expect(attached).toHaveLength(0);
    expect(latestTransition?.selectionConfirmedAt).not.toBeNull();
    expect(latestTransition?.transitionData).toMatchObject({
      manualSelection: { at: expect.any(String) },
    });
  });

  it('refuses a second publish, and confirm and unconfirm for reviewers and admins, after publish', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createPublishSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    await reviewer.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.publishDevelopedProposals({
      processInstanceId: instanceId,
    });

    await expect(
      adminCaller.decision.publishDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(conflict);

    await expect(
      reviewer.caller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(invalid);
    await expect(
      reviewer.caller.decision.unconfirmCategoryDevelopment({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject(invalid);
    await expect(
      adminCaller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject(invalid);
    await expect(
      adminCaller.decision.unconfirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject(invalid);
  });
});

/**
 * A develop phase with an open window, one source and two category terms.
 * Entries of the phase are created hidden.
 */
async function createPublishSetup({
  testData,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: OnTestFinished;
}) {
  const [{ setup, instanceId, source }, { terms }] = await Promise.all([
    createDevelopPhaseSetup({ testData }),
    seedTwoCategories(onTestFinished),
  ]);
  const [termA, termB] = terms;
  if (!termA || !termB) {
    throw new Error('Expected two category terms');
  }
  await hideEntriesByDefault(instanceId);

  return { setup, instanceId, source, termA, termB };
}

/** A member with Develop Proposals and the given rows. */
async function createReviewer(
  params: Parameters<typeof createCategoryDevelopReviewer>[0],
) {
  const reviewer = await createCategoryDevelopReviewer(params);
  const caller = await createAuthenticatedCaller(reviewer.email);

  return { ...reviewer, caller };
}

async function createEntry({
  testData,
  caller,
  instanceId,
  source,
}: {
  testData: TestDecisionsDataManager;
  caller: Awaited<ReturnType<typeof createAuthenticatedCaller>>;
  instanceId: string;
  source: { id: string };
}) {
  const entry = await caller.decision.createDevelopedProposal({
    processInstanceId: instanceId,
    sourceProposalIds: [source.id],
    proposalData: { title: 'Developed' },
  });
  testData.trackProfileForCleanup(entry.profileId);

  return entry;
}

/** Attaches `proposalId` to the inbound transition and holds it for approval. */
async function holdPipelineSelection({
  instanceId,
  proposalId,
}: {
  instanceId: string;
  proposalId: string;
}): Promise<void> {
  const [latestTransition, latestHistory] = await Promise.all([
    db.query.stateTransitionHistory.findFirst({
      where: { processInstanceId: instanceId },
      orderBy: { transitionedAt: 'desc' },
      columns: { id: true },
    }),
    db
      .select({ historyId: proposalHistory.historyId })
      .from(proposalHistory)
      .where(eq(proposalHistory.id, proposalId))
      .orderBy(desc(proposalHistory.historyCreatedAt))
      .limit(1),
  ]);
  const historyId = latestHistory[0]?.historyId;
  if (!latestTransition || !historyId) {
    throw new Error(`Instance ${instanceId} has no transition to hold`);
  }

  await db.insert(decisionTransitionProposals).values({
    processInstanceId: instanceId,
    transitionHistoryId: latestTransition.id,
    proposalId,
    proposalHistoryId: historyId,
  });
  await db
    .update(stateTransitionHistory)
    .set({ selectionConfirmedAt: null })
    .where(eq(stateTransitionHistory.id, latestTransition.id));
}

/** Sets `defaults.hidden` on the develop phase ("final"). */
async function hideEntriesByDefault(processInstanceId: string): Promise<void> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { instanceData: true },
  });
  const instanceData = instance?.instanceData;
  if (instanceData === null || typeof instanceData !== 'object') {
    throw new Error(`Instance ${processInstanceId} has no instanceData`);
  }

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        phases: getInstancePhases(instanceData).map((phase) =>
          phase.phaseId === 'final'
            ? {
                ...phase,
                rules: {
                  ...phase.rules,
                  proposals: {
                    ...phase.rules?.proposals,
                    defaults: {
                      ...phase.rules?.proposals?.defaults,
                      hidden: true,
                    },
                  },
                },
              }
            : phase,
        ),
      },
    })
    .where(eq(processInstances.id, processInstanceId));
  await syncPhaseRows(processInstanceId);
}
