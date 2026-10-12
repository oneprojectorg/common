import {
  type DecisionSchemaDefinition,
  getProposalIdsForPhase,
} from '@op/common';
import { RejectionReason } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
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
  it('lists left-behind proposals for an admin on the All tab, flagged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, advanced, leftBehind, alsoLeftBehind } =
      await seedReviewPhase(testData);

    const { items, total } = await admin.decision.listProposals({
      processInstanceId: instanceId,
      notAdvanced: 'include',
    });

    expect(total).toBe(3);
    expect(outsideById(items)).toEqual({
      [advanced]: false,
      [leftBehind]: true,
      [alsoLeftBehind]: true,
    });
  });

  it('narrows the Not advanced filter to left-behind and rejected proposals', async ({
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
      notAdvanced: 'only',
    });

    // The advanced-by-hand one is in the phase now; the rejected one stays.
    expect(outsideById(items)).toEqual({
      [advanced]: false,
      [leftBehind]: true,
    });
  });

  it('keeps the list as it was for non-admins and when not asked', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, admin, memberCaller, advanced } =
      await seedReviewPhase(testData);

    const [memberList, adminDefault] = await Promise.all([
      memberCaller.decision.listProposals({
        processInstanceId: instanceId,
        notAdvanced: 'include',
      }),
      admin.decision.listProposals({ processInstanceId: instanceId }),
    ]);

    expect(memberList.items.map((p) => p.id)).toEqual([advanced]);
    expect(memberList.items[0]?.isOutsideCurrentPhase).toBeUndefined();
    expect(adminDefault.items.map((p) => p.id)).toEqual([advanced]);
  });
});
