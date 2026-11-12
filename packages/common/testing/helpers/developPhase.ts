import { ProcessStatus, ProposalStatus } from '@op/db/schema';

import {
  grantInstanceReviewerRole,
  testDevelopSchema,
} from '../data/decision-data';
import { createCategoryReviewerWithTerm } from '../data/review-data';
import type { TestDecisionsDataManager } from './TestDecisionsDataManager';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

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
 * A member with Review (no Submit) on the instance and, unless `withRow` is
 * false, a category-reviewer row for the develop phase.
 */
export async function createDevelopPhaseReviewer({
  testData,
  setup,
  onTestFinished,
  withRow = true,
}: {
  testData: TestDecisionsDataManager;
  setup: Awaited<ReturnType<typeof createDevelopPhaseSetup>>['setup'];
  onTestFinished: OnTestFinished;
  withRow?: boolean;
}) {
  const member = await testData.createMemberUser({
    organization: setup.organization,
  });
  await grantInstanceReviewerRole({
    instanceProfileId: setup.instance.profileId,
    authUserId: member.authUserId,
    email: member.email,
    roleName: `Reviewer ${member.authUserId}`,
  });
  if (withRow) {
    await createCategoryReviewerWithTerm({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: 'final',
      onTestFinished,
    });
  }
  return member;
}
