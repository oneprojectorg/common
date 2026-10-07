import { TestDecisionsDataManager } from '@op/common/testing';

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
