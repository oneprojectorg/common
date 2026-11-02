import { type DecisionInstanceData, getInstancePhases } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
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
  testData.trackProfileForCleanup(phase.profileId);

  // The fixture mints a row per template phase; phase tests expect only their own.
  const minted = await listPhaseIds(setup.instance.instance.id);
  await Promise.all(
    minted
      .filter((phaseId) => phaseId !== phase.id)
      .map((phaseId) => adminCaller.decision.deletePhase({ phaseId })),
  );

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

export const loadPhaseRows = (processInstanceId: string) =>
  db
    .select({
      id: processPhases.id,
      sortOrder: processPhases.sortOrder,
      profileId: processPhases.profileId,
      data: processPhases.data,
      name: profiles.name,
      type: profiles.type,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, processInstanceId))
    .orderBy(asc(processPhases.sortOrder));

// TODO: remove the blob helpers below when instance_data.phases is dropped.
export const loadBlobPhases = async (processInstanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { instanceData: true },
  });
  return getInstancePhases(instance?.instanceData);
};

export const reorderBlobPhases = async (
  processInstanceId: string,
  phaseIds: string[],
) => {
  const phases = [...(await loadBlobPhases(processInstanceId))].sort(
    (a, b) => phaseIds.indexOf(a.phaseId) - phaseIds.indexOf(b.phaseId),
  );
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(phases)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId));
};

export const listPhaseIds = async (processInstanceId: string) =>
  (
    await db.query.processPhases.findMany({
      where: { processInstanceId },
      columns: { id: true },
      orderBy: { id: 'asc' },
    })
  ).map((phase) => phase.id);

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

export const expectRowsMirrorPhases = (
  rows: Awaited<ReturnType<typeof loadPhaseRows>>,
  phases: readonly { phaseId: string; name?: string }[],
) =>
  expect(rows).toMatchObject(
    phases.map((phase, sortOrder) => ({
      sortOrder,
      name: phase.name ?? phase.phaseId,
      type: 'phase',
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
