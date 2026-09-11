import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const gatingInput = { instanceId: crypto.randomUUID() };

describeAccessTierGating('platform.admin.getDecisionInstance', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.getDecisionInstance(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.getDecisionInstance(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(
        caller.platform.admin.getDecisionInstance(gatingInput),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.getDecisionInstance(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.getDecisionInstance', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  it('throws for a non-platform-admin caller', async ({
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

    await expect(() =>
      caller.getDecisionInstance({ instanceId: crypto.randomUUID() }),
    ).rejects.toThrow();
  });

  it('returns instance detail with phases and capability flags', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const detail = await caller.getDecisionInstance({ instanceId });

    expect(detail.id).toBe(instanceId);
    expect(detail.name).toBeTruthy();
    expect(detail.owner).not.toBeNull();
    expect(detail.steward).not.toBeNull();
    expect(detail.phases.length).toBeGreaterThan(0);

    // Exactly the instance's current phase is flagged.
    const currentPhases = detail.phases.filter((phase) => phase.isCurrent);
    expect(currentPhases.length).toBeLessThanOrEqual(1);

    for (const phase of detail.phases) {
      expect(typeof phase.hasProposals).toBe('boolean');
      expect(typeof phase.hasReviews).toBe('boolean');
      expect(typeof phase.hasVoting).toBe('boolean');
    }
  });

  it('throws NotFound for an unknown instance id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(() =>
      caller.getDecisionInstance({ instanceId: crypto.randomUUID() }),
    ).rejects.toThrow();
  });
});
