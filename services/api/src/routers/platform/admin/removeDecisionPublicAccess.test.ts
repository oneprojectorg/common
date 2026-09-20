import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { ROLES, ZONES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

const createCaller = createCallerFactory(appRouter);

const gatingInput = { instanceId: crypto.randomUUID() };

describeAccessTierGating('platform.admin.removeDecisionPublicAccess', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.removeDecisionPublicAccess(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.removeDecisionPublicAccess(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.removeDecisionPublicAccess(gatingInput),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.removeDecisionPublicAccess(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.removeDecisionPublicAccess', () => {
  /** A published, already-public decision plus its platform-admin caller. */
  const createPublicInstance = async (
    taskId: string,
    onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
  ) => {
    const testData = new TestDecisionsDataManager(taskId, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));
    const instanceId = setup.instance.instance.id;
    const { profileId } = setup.instance;

    await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: { submitProposals: true, vote: true },
    });

    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      columns: { slug: true },
    });

    return { testData, caller, instanceId, profileId, slug: profile!.slug! };
  };

  const readPublicGrants = async (profileId: string) => {
    const [members, overrides] = await Promise.all([
      db.query.profileUsers.findMany({
        where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
        columns: { id: true },
      }),
      db.query.accessRolePermissionsOnAccessZones.findMany({
        where: {
          profileId,
          accessRoleId: ROLES.PUBLIC.id,
          accessZoneId: ZONES.DECISIONS.id,
        },
        columns: { permission: true },
      }),
    ]);

    return { members, overrides };
  };

  it('shuts a visitor out again', async ({ task, onTestFinished }) => {
    const { caller, instanceId, profileId, slug } = await createPublicInstance(
      task.id,
      onTestFinished,
    );

    const visitor = createCaller(await createTestContextWithSession(null));

    // Read it first, so the removal has to beat the cached access record.
    const visible = await visitor.decision.getDecisionBySlug({ slug });
    expect(visible.processInstance.id).toBe(instanceId);

    const result = await caller.platform.admin.removeDecisionPublicAccess({
      instanceId,
    });
    expect(result).toEqual({ profileId });

    await expect(
      visitor.decision.getDecisionBySlug({ slug }),
    ).rejects.toThrow();
  });

  it('deletes the sentinel, its role link, and the override', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId, profileId } = await createPublicInstance(
      task.id,
      onTestFinished,
    );

    const before = await readPublicGrants(profileId);
    expect(before.members).toHaveLength(1);
    const sentinelId = before.members[0]!.id;

    await caller.platform.admin.removeDecisionPublicAccess({ instanceId });

    const after = await readPublicGrants(profileId);
    expect(after.members).toHaveLength(0);
    expect(after.overrides).toHaveLength(0);

    // Cascades off the deleted member row.
    const roleLinks = await db.query.profileUserToAccessRoles.findMany({
      where: { profileUserId: sentinelId },
      columns: { accessRoleId: true },
    });
    expect(roleLinks).toHaveLength(0);

    const detail = await caller.platform.admin.getDecisionInstance({
      instanceId,
    });
    expect(detail.isPublic).toBe(false);
  });

  it('keeps the decision readable for its own members', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId, slug } = await createPublicInstance(
      task.id,
      onTestFinished,
    );

    await caller.platform.admin.removeDecisionPublicAccess({ instanceId });

    const stillVisible = await caller.decision.getDecisionBySlug({ slug });
    expect(stillVisible.processInstance.id).toBe(instanceId);
  });

  it('is a no-op on a decision that was never public', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.platform.admin.removeDecisionPublicAccess({
        instanceId: setup.instance.instance.id,
      }),
    ).resolves.toEqual({ profileId: setup.instance.profileId });
  });

  it('leaves another public decision open', async ({
    task,
    onTestFinished,
  }) => {
    const closed = await createPublicInstance(task.id, onTestFinished);
    const other = await createPublicInstance(
      `${task.id}-other`,
      onTestFinished,
    );

    await closed.caller.platform.admin.removeDecisionPublicAccess({
      instanceId: closed.instanceId,
    });

    const grants = await readPublicGrants(other.profileId);
    expect(grants.members).toHaveLength(1);
    expect(grants.overrides).toHaveLength(1);

    const visitor = createCaller(await createTestContextWithSession(null));
    const visible = await visitor.decision.getDecisionBySlug({
      slug: other.slug,
    });
    expect(visible.processInstance.id).toBe(other.instanceId);
  });

  it('can be re-opened after removal', async ({ task, onTestFinished }) => {
    const { caller, instanceId, slug } = await createPublicInstance(
      task.id,
      onTestFinished,
    );

    await caller.platform.admin.removeDecisionPublicAccess({ instanceId });
    await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: { submitProposals: false, vote: false },
    });

    const visitor = createCaller(await createTestContextWithSession(null));
    const visible = await visitor.decision.getDecisionBySlug({ slug });
    expect(visible.processInstance.access).toMatchObject({
      read: true,
      submitProposals: false,
      vote: false,
    });
  });
});
