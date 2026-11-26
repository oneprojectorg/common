import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
} from '@op/db/schema';

import { getInstancePhases } from '../../src';
import {
  TEST_PERMISSION_BITS,
  grantInstanceRole,
  testDevelopSchema,
} from '../data/decision-data';
import type { TestDecisionsDataManager } from './TestDecisionsDataManager';
import { syncPhaseRows } from './phaseRowFixtures';

/**
 * A published instance in its develop phase ("final") with `sourceCount`
 * submitted proposals from the previous phase ("initial"): `source`, then
 * `otherSources`. The setup user is an admin of the instance. The develop
 * window is open: no selection is confirmed yet.
 */
export async function createDevelopPhaseSetup({
  testData,
  instanceCount = 1,
  sourceCount = 1,
}: {
  testData: TestDecisionsDataManager;
  instanceCount?: number;
  sourceCount?: number;
}) {
  const setup = await testData.createDecisionSetup({
    instanceCount,
    grantAccess: true,
    processSchema: testDevelopSchema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;
  const source = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: instanceId,
    proposalData: { title: 'Source' },
    status: ProposalStatus.SUBMITTED,
  });
  const otherSources: Array<typeof source> = [];
  for (let index = 1; index < sourceCount; index++) {
    otherSources.push(
      await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Source ${index + 1}` },
        status: ProposalStatus.SUBMITTED,
      }),
    );
  }
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'initial',
    toPhaseId: 'final',
  });
  await openDevelopWindow({ instanceId });

  return { setup, instanceId, source, otherSources };
}

/**
 * Detaches every proposal from the inbound transition, so the selections of
 * the current phase are pending and the develop window is open.
 */
export async function openDevelopWindow({
  instanceId,
}: {
  instanceId: string;
}): Promise<void> {
  await db
    .delete(decisionTransitionProposals)
    .where(eq(decisionTransitionProposals.processInstanceId, instanceId));
}

/**
 * A member whose only decisions grant on the instance is a role with Read and
 * Develop Proposals (no Review, no Submit).
 */
export async function createDevelopProposalsMember({
  testData,
  setup,
}: {
  testData: TestDecisionsDataManager;
  setup: Awaited<ReturnType<typeof createDevelopPhaseSetup>>['setup'];
}) {
  const member = await testData.createMemberUser({
    organization: setup.organization,
  });
  await grantInstanceRole({
    instanceProfileId: setup.instance.profileId,
    authUserId: member.authUserId,
    email: member.email,
    roleName: `Develop Proposals ${member.authUserId}`,
    decisionsPermission:
      TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.DEVELOP_PROPOSALS,
  });
  return member;
}

/** Appends a results phase, so the develop phase is no longer the last. */
export async function addResultsPhase({
  instanceId,
}: {
  instanceId: string;
}): Promise<void> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { instanceData: true },
  });
  const instanceData = instance?.instanceData;
  if (instanceData === null || typeof instanceData !== 'object') {
    throw new Error(`Instance ${instanceId} has no instanceData`);
  }

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        phases: [
          ...getInstancePhases(instanceData),
          { phaseId: 'results', name: 'Results', rules: {} },
        ],
      },
    })
    .where(eq(processInstances.id, instanceId));
  await syncPhaseRows(instanceId);
}
