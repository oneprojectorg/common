import {
  type DecisionSchemaDefinition,
  getProposalIdsForPhase,
} from '@op/common';
import { RejectionReason } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus, ProposalStatus, Visibility } from '@op/db/schema';
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

/** submission keeps one of its proposals, so the rest are left behind. */
const schema = {
  id: 'list-not-advanced-schema',
  version: '1.0.0',
  name: 'List Not Advanced Schema',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-block', type: 'limit', count: 1 }],
      },
    },
    { id: 'review', name: 'Review', rules: {} },
    { id: 'results', name: 'Results', rules: {} },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * A published instance in `review` with three submitted proposals, one of
 * which the pipeline carried over: returns it and the two it left behind.
 */
async function seedReviewPhase(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: schema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;
  const member = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [setup.instance.profileId],
  });

  const created = await Promise.all(
    ['First', 'Second', 'Third'].map((title) =>
      testData.createProposal({
        userEmail: member.email,
        processInstanceId: instanceId,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
      }),
    ),
  );
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'submission',
    toPhaseId: 'review',
  });

  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, instanceData: true, currentStateId: true },
  });
  if (!instance) {
    throw new Error('Expected instance to exist');
  }
  const inReview = await getProposalIdsForPhase({ instance });
  const advanced = created.find((p) => inReview.includes(p.id));
  const [leftBehind, alsoLeftBehind] = created.filter(
    (p) => !inReview.includes(p.id),
  );
  if (!advanced || !leftBehind || !alsoLeftBehind) {
    throw new Error('Expected the pipeline to keep exactly one proposal');
  }

  const [admin, memberCaller] = await Promise.all([
    createAuthenticatedCaller(setup.userEmail),
    createAuthenticatedCaller(member.email),
  ]);

  return {
    instanceId,
    admin,
    memberCaller,
    createViewer: async () =>
      createAuthenticatedCaller(
        (
          await testData.createMemberUser({
            organization: setup.organization,
            instanceProfileIds: [setup.instance.profileId],
          })
        ).email,
      ),
    advanced: advanced.id,
    leftBehind: leftBehind.id,
    alsoLeftBehind: alsoLeftBehind.id,
  };
}

/** `id → isOutsideCurrentPhase` for every row the list returns. */
const outsideById = (
  items: { id: string; isOutsideCurrentPhase?: boolean }[],
) => Object.fromEntries(items.map((p) => [p.id, p.isOutsideCurrentPhase]));

describe.concurrent('listProposals: not advanced', () => {
  it('lists what earlier phases left behind under Not advanced for an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, leftBehind, alsoLeftBehind } =
      await seedReviewPhase(testData);

    const { items, total } = await admin.decision.listProposals({
      processInstanceId: instanceId,
      notAdvanced: true,
    });

    expect(total).toBe(2);
    expect(outsideById(items)).toEqual({
      [leftBehind]: true,
      [alsoLeftBehind]: true,
    });
    // The card's kebab reads this instead of asking per row.
    const target = { phaseId: 'review', phaseName: 'Review' };
    expect(
      Object.fromEntries(items.map((p) => [p.id, p.advanceTarget])),
    ).toEqual({ [leftBehind]: target, [alsoLeftBehind]: target });
  });

  it("lists them in the review phase's Other proposals tab too", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, leftBehind, alsoLeftBehind } =
      await seedReviewPhase(testData);

    // "Other proposals" is the list minus the caller's own review queue.
    const { items } = await admin.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
      notAdvanced: true,
    });

    expect(outsideById(items)).toEqual({
      [leftBehind]: true,
      [alsoLeftBehind]: true,
    });
  });

  it('lists rejected proposals alongside, and drops one once advanced', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, advanced, leftBehind, alsoLeftBehind } =
      await seedReviewPhase(testData);
    await admin.decision.advanceProposal({
      proposalId: alsoLeftBehind,
      phaseId: 'review',
    });
    await admin.decision.rejectProposal({
      proposalId: advanced,
      reason: RejectionReason.INELIGIBLE,
    });

    const { items } = await admin.decision.listProposals({
      processInstanceId: instanceId,
      notAdvanced: true,
    });

    // The advanced-by-hand one is in the phase now; the rejected one stays.
    expect(outsideById(items)).toEqual({
      [advanced]: false,
      [leftBehind]: true,
    });
  });

  it('gives non-admins the same Not advanced list, without the advance action', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      admin,
      memberCaller,
      advanced,
      leftBehind,
      alsoLeftBehind,
    } = await seedReviewPhase(testData);
    await admin.decision.rejectProposal({
      proposalId: advanced,
      reason: RejectionReason.INELIGIBLE,
    });

    const { items, total } = await memberCaller.decision.listProposals({
      processInstanceId: instanceId,
      notAdvanced: true,
    });

    expect(total).toBe(3);
    expect(outsideById(items)).toEqual({
      [advanced]: false,
      [leftBehind]: true,
      [alsoLeftBehind]: true,
    });
    expect(items.map((p) => p.advanceTarget)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps a hidden left-behind proposal from members who cannot see it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      admin,
      memberCaller,
      createViewer,
      leftBehind,
      alsoLeftBehind,
    } = await seedReviewPhase(testData);
    const [viewerCaller] = await Promise.all([
      createViewer(),
      admin.decision.updateProposal({
        proposalId: leftBehind,
        data: { visibility: Visibility.HIDDEN },
      }),
    ]);

    const listNotAdvanced = (caller: typeof memberCaller) =>
      caller.decision.listProposals({
        processInstanceId: instanceId,
        notAdvanced: true,
      });
    const [viewerList, authorList] = await Promise.all([
      listNotAdvanced(viewerCaller),
      listNotAdvanced(memberCaller),
    ]);

    expect(viewerList.items.map((p) => p.id)).toEqual([alsoLeftBehind]);
    expect(viewerList.total).toBe(1);
    // The author still sees their hidden proposal.
    expect(authorList.total).toBe(2);
  });

  it('lists a proposal rejected in an earlier phase once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, memberCaller, leftBehind, alsoLeftBehind } =
      await seedReviewPhase(testData);
    await admin.decision.rejectProposal({
      proposalId: leftBehind,
      reason: RejectionReason.INELIGIBLE,
    });

    const lists = await Promise.all(
      [memberCaller, admin].map((caller) =>
        caller.decision.listProposals({
          processInstanceId: instanceId,
          notAdvanced: true,
        }),
      ),
    );

    for (const { items, total } of lists) {
      expect(total).toBe(2);
      expect(outsideById(items)).toEqual({
        [leftBehind]: true,
        [alsoLeftBehind]: true,
      });
    }
  });

  it('keeps an explicitly chosen phase to its own rejected proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, advanced, leftBehind } =
      await seedReviewPhase(testData);
    // One rejected in the phase, one rejected before it.
    await Promise.all(
      [advanced, leftBehind].map((proposalId) =>
        admin.decision.rejectProposal({
          proposalId,
          reason: RejectionReason.INELIGIBLE,
        }),
      ),
    );

    const { items } = await admin.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
      notAdvanced: true,
    });

    expect(items.map((p) => p.id)).toEqual([advanced]);
    expect(items[0]?.isOutsideCurrentPhase).toBeUndefined();
  });

  it('lists only the phase without the filter (All proposals)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, advanced } = await seedReviewPhase(testData);

    const { items } = await admin.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(items.map((p) => p.id)).toEqual([advanced]);
    expect(items[0]?.isOutsideCurrentPhase).toBeUndefined();
  });

  it('drops rejected proposals from All for everyone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, memberCaller, advanced, alsoLeftBehind } =
      await seedReviewPhase(testData);
    await admin.decision.advanceProposal({
      proposalId: alsoLeftBehind,
      phaseId: 'review',
    });
    await admin.decision.rejectProposal({
      proposalId: advanced,
      reason: RejectionReason.INELIGIBLE,
    });

    const lists = await Promise.all(
      [memberCaller, admin].map((caller) =>
        caller.decision.listProposals({ processInstanceId: instanceId }),
      ),
    );

    for (const { items, total } of lists) {
      expect(items.map((p) => p.id)).toEqual([alsoLeftBehind]);
      expect(total).toBe(1);
    }
  });
});
