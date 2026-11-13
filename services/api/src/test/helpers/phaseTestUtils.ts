import {
  type DecisionInstanceData,
  type DecisionSchemaDefinition,
  getInstancePhases,
  getPhases,
} from '@op/common';
import {
  TestDecisionsDataManager,
  dateAdvancementSchema,
  loadPhaseRows,
} from '@op/common/testing';
import { asc, db, eq } from '@op/db/client';
import { ProcessStatus, decisionProcessTransitions } from '@op/db/schema';
import { expect } from 'vitest';

import { appRouter } from '../../routers';
import { createCallerFactory } from '../../trpcFactory';
import {
  createAuthenticatedCaller,
  createTestContextWithSession,
} from '../supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

const createCaller = createCallerFactory(appRouter);

export const PHASE_NAME = 'Review';

export async function setupPhase(
  task: { id: string },
  onTestFinished: OnTestFinished,
) {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  const adminCaller = await createAuthenticatedCaller(setup.userEmail);
  const phase = await adminCaller.decision.createPhase({
    instanceId: setup.instance.instance.id,
    name: PHASE_NAME,
    sortOrder: 0,
  });

  // The fixture mints a row per template phase; phase tests expect only their own.
  await testData.removePhaseRows(setup.instance.instance.id, {
    exceptRowId: phase.id,
  });

  const createMemberCaller = async () => {
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    return createAuthenticatedCaller(member.email);
  };

  const createOtherDecisionAdminCaller = async () => {
    const other = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    return createAuthenticatedCaller(other.userEmail);
  };

  const createOutsiderCaller = async () => {
    const outsider = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });
    return createAuthenticatedCaller(outsider.userEmail);
  };

  return {
    phase,
    adminCaller,
    trackProfileForCleanup: (profileId: string) =>
      testData.trackProfileForCleanup(profileId),
    createMemberCaller,
    createOtherDecisionAdminCaller,
    createOutsiderCaller,
  };
}

export async function createUnauthenticatedCaller() {
  return createCaller(await createTestContextWithSession(null));
}

export { loadPhaseRows };

export const loadTransitionLinks = async (processInstanceId: string) =>
  (
    await db
      .select({
        fromStateId: decisionProcessTransitions.fromStateId,
        toStateId: decisionProcessTransitions.toStateId,
        fromPhaseId: decisionProcessTransitions.fromPhaseId,
        toPhaseId: decisionProcessTransitions.toPhaseId,
        scheduledDate: decisionProcessTransitions.scheduledDate,
      })
      .from(decisionProcessTransitions)
      .where(
        eq(decisionProcessTransitions.processInstanceId, processInstanceId),
      )
      .orderBy(
        asc(decisionProcessTransitions.fromStateId),
        asc(decisionProcessTransitions.toStateId),
      )
  ).map((link) => ({
    ...link,
    scheduledDate: new Date(link.scheduledDate).toISOString(),
  }));

// TODO: remove when instance_data.phases is dropped.
export const loadBlobPhases = async (processInstanceId: string) =>
  getInstancePhases((await loadInstanceData(processInstanceId)).instanceData);

export const loadInstancePhases = async (processInstanceId: string) =>
  getPhases({ instance: (await loadInstanceData(processInstanceId)).instance });

export const listPhaseIds = async (processInstanceId: string) =>
  (
    await db.query.processPhases.findMany({
      where: { processInstanceId },
      columns: { id: true },
      orderBy: { id: 'asc' },
    })
  ).map((phase) => phase.id);

// A published decision whose `initial` phase advances by date to `final`, so one transition is pending.
export async function setupPublishedDateDecision(
  task: { id: string },
  onTestFinished: OnTestFinished,
) {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    processSchema: dateAdvancementSchema,
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;
  const adminCaller = await createAuthenticatedCaller(setup.userEmail);
  const [draftInitial] = await loadPhaseRows(instanceId);
  if (!draftInitial) {
    throw new Error('Expected the template phase rows');
  }

  const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  await adminCaller.decision.updatePhase({
    phaseId: draftInitial.id,
    data: { endDate },
  });
  await adminCaller.decision.updateDecisionInstance({
    instanceId,
    status: ProcessStatus.PUBLISHED,
  });
  const [initial, final] = await loadPhaseRows(instanceId);
  if (!initial || !final) {
    throw new Error('Expected the template phase rows');
  }

  return { testData, instanceId, adminCaller, initial, final, endDate };
}

const datePhase = (id: string, name: string) => ({
  id,
  name,
  rules: { advancement: { method: 'date' as const } },
  selectionPipeline: { version: '1.0.0', blocks: [] },
});

const fourPhaseDateSchema = {
  id: 'four-phase-date',
  version: '1.0.0',
  name: 'Four Phase Date',
  phases: [
    datePhase('submission', 'Submission'),
    datePhase('review', 'Review'),
    datePhase('voting', 'Voting'),
    datePhase('results', 'Results'),
  ],
} satisfies DecisionSchemaDefinition;

// A published decision whose four phases all advance by date, moved on to `voting`
// so the submission→review and review→voting transitions are complete.
export async function setupPublishedDecisionAtThirdPhase(
  task: { id: string },
  onTestFinished: OnTestFinished,
) {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    processSchema: fourPhaseDateSchema,
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;
  const adminCaller = await createAuthenticatedCaller(setup.userEmail);

  const dayMs = 24 * 60 * 60 * 1000;
  const draftRows = await loadPhaseRows(instanceId);
  for (const [index, row] of draftRows.slice(0, -1).entries()) {
    await adminCaller.decision.updatePhase({
      phaseId: row.id,
      data: {
        endDate: new Date(Date.now() + (index + 1) * dayMs).toISOString(),
      },
    });
  }
  await adminCaller.decision.updateDecisionInstance({
    instanceId,
    status: ProcessStatus.PUBLISHED,
  });

  for (const [fromPhaseId, toPhaseId] of [
    ['submission', 'review'],
    ['review', 'voting'],
  ] as const) {
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId,
      toPhaseId,
    });
    if (advanced.conflict) {
      throw new Error(`Could not advance from ${fromPhaseId}`);
    }
  }

  const [submission, review, voting, results] = await loadPhaseRows(instanceId);
  if (!submission || !review || !voting || !results) {
    throw new Error('Expected four phase rows');
  }

  return {
    testData,
    instanceId,
    adminCaller,
    rows: { submission, review, voting, results },
  };
}

export const loadPendingTransitionLinks = async (processInstanceId: string) =>
  db.query.decisionProcessTransitions.findMany({
    where: { processInstanceId, completedAt: { isNull: true } },
    columns: {
      fromStateId: true,
      toStateId: true,
      fromPhaseId: true,
      toPhaseId: true,
    },
    orderBy: { fromStateId: 'asc' },
  });

export async function loadInstanceData(instanceId: string) {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error(`Instance ${instanceId} was not created`);
  }

  return {
    instance,
    instanceData: instance.instanceData as DecisionInstanceData,
  };
}

export const expectRowsMatchPhases = (
  rows: Awaited<ReturnType<typeof loadPhaseRows>>,
  phases: readonly { phaseId: string; name?: string }[],
) =>
  expect(rows).toMatchObject(
    phases.map((phase, sortOrder) => ({
      sortOrder,
      name: phase.name ?? phase.phaseId,
      data: { phaseId: phase.phaseId },
    })),
  );

export const expectNoProfileNamed = async (name: string) => {
  const leftover = await db.query.profiles.findMany({
    where: { name },
    columns: { id: true },
  });
  expect(leftover).toHaveLength(0);
};

export const expectNothingNamed = async (name: string) => {
  const [instances] = await Promise.all([
    db.query.processInstances.findMany({
      where: { name },
      columns: { id: true },
    }),
    expectNoProfileNamed(name),
  ]);
  expect(instances).toHaveLength(0);
};
