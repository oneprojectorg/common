import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
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

export const listPhaseIds = async (processInstanceId: string) =>
  (
    await db.query.processPhases.findMany({
      where: { processInstanceId },
      columns: { id: true },
      orderBy: { id: 'asc' },
    })
  ).map((phase) => phase.id);

export const expectNothingNamed = async (name: string) => {
  const [instances, decisionProfiles] = await Promise.all([
    db.query.processInstances.findMany({
      where: { name },
      columns: { id: true },
    }),
    db.query.profiles.findMany({ where: { name }, columns: { id: true } }),
  ]);
  expect(instances).toHaveLength(0);
  expect(decisionProfiles).toHaveLength(0);
};
