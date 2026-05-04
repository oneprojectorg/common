import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

describe.concurrent('platform.admin.listAllDecisionInstances', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  it('should throw when a non-platform-admin tries to list decision instances', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
      emailDomain: 'example.com',
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(() => caller.listAllDecisionInstances()).rejects.toThrow();
  });

  it('proposalCount excludes drafts; totalProposalCount includes them', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;

    await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Draft 1 ${task.id}` },
        status: ProposalStatus.DRAFT,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Draft 2 ${task.id}` },
        status: ProposalStatus.DRAFT,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Submitted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Approved ${task.id}` },
        status: ProposalStatus.APPROVED,
      }),
    ]);

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    // Filter to just our instance (other concurrent tests may create others).
    const result = await caller.listAllDecisionInstances({ query: task.id });
    const ours = result.items.find((i) => i.id === instanceId);

    expect(ours).toBeDefined();
    expect(ours?.proposalCount).toBe(2);
    expect(ours?.totalProposalCount).toBe(4);
  });

  it('counts are zero when an instance has no proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listAllDecisionInstances({ query: task.id });
    const ours = result.items.find((i) => i.id === instanceId);

    expect(ours).toBeDefined();
    expect(ours?.proposalCount).toBe(0);
    expect(ours?.totalProposalCount).toBe(0);
  });
});
