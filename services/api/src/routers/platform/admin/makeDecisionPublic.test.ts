import { decisionPermission } from '@op/common';
import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { ROLES, ZONES } from '@op/db/seedData/accessControl';
import { permission } from 'access-zones';
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

/** What the runbook grants the public: read the decision, propose, and vote. */
const EXPECTED_PUBLIC_PERMISSION =
  permission.READ |
  decisionPermission.SUBMIT_PROPOSALS |
  decisionPermission.VOTE;

/** Every capability on — the default the dialog opens with. */
const ALL_PERMISSIONS = { submitProposals: true, vote: true };

const gatingInput = {
  instanceId: crypto.randomUUID(),
  permissions: ALL_PERMISSIONS,
};

describeAccessTierGating('platform.admin.makeDecisionPublic', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.makeDecisionPublic(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.makeDecisionPublic(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      // Out-of-network callers are turned away by the network gate, before
      // the platform-admin allow list is ever consulted.
      await expectFailsAccessTierGate(
        caller.platform.admin.makeDecisionPublic(gatingInput),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.makeDecisionPublic(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.makeDecisionPublic', () => {
  /** A published instance owned by a platform admin, plus their admin caller. */
  const createPublishedInstance = async (
    taskId: string,
    onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
    status: ProcessStatus = ProcessStatus.PUBLISHED,
  ) => {
    const testData = new TestDecisionsDataManager(taskId, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status,
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    return {
      testData,
      caller,
      instanceId: setup.instance.instance.id,
      profileId: setup.instance.profileId,
    };
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

  it('lets a visitor with no account read the decision', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId, profileId } = await createPublishedInstance(
      task.id,
      onTestFinished,
    );

    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      columns: { slug: true },
    });
    const slug = profile?.slug;
    expect(slug).toBeTruthy();

    const visitor = createCaller(await createTestContextWithSession(null));

    await expect(
      visitor.decision.getDecisionBySlug({ slug: slug! }),
    ).rejects.toThrow();

    const result = await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: ALL_PERMISSIONS,
    });
    expect(result).toEqual({ profileId });

    const visible = await visitor.decision.getDecisionBySlug({ slug: slug! });
    expect(visible.processInstance.id).toBe(instanceId);
    // The grant is what the visitor gets back, not just a readable row.
    expect(visible.processInstance.access).toMatchObject({
      read: true,
      submitProposals: true,
      vote: true,
      admin: false,
    });
  });

  it('writes the public sentinel, its role link, and a profile-scoped override', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId, profileId } = await createPublishedInstance(
      task.id,
      onTestFinished,
    );

    await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: ALL_PERMISSIONS,
    });

    const { members, overrides } = await readPublicGrants(profileId);
    expect(members).toHaveLength(1);
    expect(overrides).toEqual([{ permission: EXPECTED_PUBLIC_PERMISSION }]);

    const roleLinks = await db.query.profileUserToAccessRoles.findMany({
      where: { profileUserId: members[0]!.id },
      columns: { accessRoleId: true },
    });
    expect(roleLinks).toEqual([{ accessRoleId: ROLES.PUBLIC.id }]);
  });

  const grantCases = [
    {
      name: 'read only',
      permissions: { submitProposals: false, vote: false },
      bits: permission.READ,
      access: { read: true, submitProposals: false, vote: false },
    },
    {
      name: 'read and vote',
      permissions: { submitProposals: false, vote: true },
      bits: permission.READ | decisionPermission.VOTE,
      access: { read: true, submitProposals: false, vote: true },
    },
    {
      name: 'read and propose',
      permissions: { submitProposals: true, vote: false },
      bits: permission.READ | decisionPermission.SUBMIT_PROPOSALS,
      access: { read: true, submitProposals: true, vote: false },
    },
  ];

  for (const { name, permissions, bits, access } of grantCases) {
    it(`grants only what the admin picked: ${name}`, async ({
      task,
      onTestFinished,
    }) => {
      const { caller, instanceId, profileId } = await createPublishedInstance(
        task.id,
        onTestFinished,
      );

      await caller.platform.admin.makeDecisionPublic({
        instanceId,
        permissions,
      });

      const { overrides } = await readPublicGrants(profileId);
      expect(overrides).toEqual([{ permission: bits }]);

      const profile = await db.query.profiles.findFirst({
        where: { id: profileId },
        columns: { slug: true },
      });
      const visitor = createCaller(await createTestContextWithSession(null));
      const visible = await visitor.decision.getDecisionBySlug({
        slug: profile!.slug!,
      });

      // Read is never optional, so the visitor reaches it either way.
      expect(visible.processInstance.access).toMatchObject(access);
    });
  }

  it('leaves every other decision private', async ({
    task,
    onTestFinished,
  }) => {
    const opened = await createPublishedInstance(task.id, onTestFinished);
    const untouched = await createPublishedInstance(
      `${task.id}-other`,
      onTestFinished,
    );

    await opened.caller.platform.admin.makeDecisionPublic({
      instanceId: opened.instanceId,
      permissions: ALL_PERMISSIONS,
    });

    const grants = await readPublicGrants(untouched.profileId);
    expect(grants.members).toHaveLength(0);
    expect(grants.overrides).toHaveLength(0);

    const detail = await untouched.caller.platform.admin.getDecisionInstance({
      instanceId: untouched.instanceId,
    });
    expect(detail.isPublic).toBe(false);
  });

  it('reports a decision opened by the runbook shape as public', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, testData, instanceId, profileId } =
      await createPublishedInstance(task.id, onTestFinished);

    // The hand-written runbook, not this endpoint — `isPublic` reads the
    // grant, so both routes to it have to agree.
    await testData.makeDecisionPublic(profileId);

    const detail = await caller.platform.admin.getDecisionInstance({
      instanceId,
    });
    expect(detail.isPublic).toBe(true);
  });

  it('is a no-op on a decision that is already public', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId, profileId } = await createPublishedInstance(
      task.id,
      onTestFinished,
    );

    await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: ALL_PERMISSIONS,
    });
    await caller.platform.admin.makeDecisionPublic({
      instanceId,
      permissions: ALL_PERMISSIONS,
    });

    const { members, overrides } = await readPublicGrants(profileId);
    expect(members).toHaveLength(1);
    expect(overrides).toEqual([{ permission: EXPECTED_PUBLIC_PERMISSION }]);
  });

  it('refuses a draft decision', async ({ task, onTestFinished }) => {
    const { caller, instanceId, profileId } = await createPublishedInstance(
      task.id,
      onTestFinished,
      ProcessStatus.DRAFT,
    );

    await expect(
      caller.platform.admin.makeDecisionPublic({
        instanceId,
        permissions: ALL_PERMISSIONS,
      }),
    ).rejects.toThrow(/published/i);

    const { members, overrides } = await readPublicGrants(profileId);
    expect(members).toHaveLength(0);
    expect(overrides).toHaveLength(0);
  });

  it('reports a decision that was never opened as not public', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, instanceId } = await createPublishedInstance(
      task.id,
      onTestFinished,
    );

    const detail = await caller.platform.admin.getDecisionInstance({
      instanceId,
    });
    expect(detail.isPublic).toBe(false);
  });
});
