import { ProcessStatus, ProposalStatus } from '@op/db/schema';

import {
  TEST_PERMISSION_BITS,
  grantInstanceRole,
  testDevelopSchema,
} from '../data/decision-data';
import type { TestDecisionsDataManager } from './TestDecisionsDataManager';

/**
 * A published instance in its develop phase ("final") with one submitted
 * proposal from the previous phase ("initial"). The setup user is an admin of
 * the instance.
 */
export async function createDevelopPhaseSetup({
  testData,
  instanceCount = 1,
}: {
  testData: TestDecisionsDataManager;
  instanceCount?: number;
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
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'initial',
    toPhaseId: 'final',
  });

  return { setup, instanceId, source };
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
