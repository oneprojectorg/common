import { TestDecisionsDataManager } from '@op/common/testing';

import { createAuthenticatedCaller } from '../supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

/**
 * A decision with one phase, created through the router by the decision's
 * admin, plus a member of the decision who is not an admin.
 */
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
    name: 'Review',
    sortOrder: 0,
    data: { phaseId: 'review' },
  });
  testData.trackProfileForCleanup(phase.profileId);

  const member = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [setup.instance.profileId],
  });
  const memberCaller = await createAuthenticatedCaller(member.email);

  return { phase, adminCaller, memberCaller };
}
