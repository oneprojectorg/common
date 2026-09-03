import {
  listOrganizationAdminRecipients,
  listProfileRecipients,
  listUserRecipient,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { ProcessStatus, authUsers, profileUsers, users } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import { schemaWithoutPipeline } from '../../test/helpers/pipelineSchemas';

/**
 * The snapshot column nothing syncs. Written on purpose so a resolver that
 * reads it delivers to the wrong inbox and fails these tests.
 */
async function writeStaleSnapshot({
  profileId,
  authUserId,
  email,
}: {
  profileId: string;
  authUserId: string;
  email: string | null;
}): Promise<void> {
  await db.insert(profileUsers).values({ profileId, authUserId, email });
}

describe.concurrent('listProfileRecipients', () => {
  it('addresses a member at their sign-in address, not the profileUsers snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const processProfileId = setup.instance.profileId;

    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    await writeStaleSnapshot({
      profileId: processProfileId,
      authUserId: member.authUserId,
      email: `stale-${member.email}`,
    });

    const recipients = await listProfileRecipients({
      profileId: processProfileId,
    });

    expect(recipients).toContainEqual({
      authUserId: member.authUserId,
      email: member.email,
    });
    expect(recipients.map(({ email }) => email)).not.toContain(
      `stale-${member.email}`,
    );
  });

  it('drops an anonymous member to a null address rather than an empty one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const processProfileId = setup.instance.profileId;

    const anonymous = await testData.createMemberUser({
      organization: setup.organization,
    });
    // Anonymous accounts carry a NULL email in auth.users, but the snapshot
    // may still hold whatever address they signed up with.
    await db
      .update(authUsers)
      .set({ email: null, isAnonymous: true })
      .where(eq(authUsers.id, anonymous.authUserId));
    await writeStaleSnapshot({
      profileId: processProfileId,
      authUserId: anonymous.authUserId,
      email: anonymous.email,
    });

    const recipients = await listProfileRecipients({
      profileId: processProfileId,
    });

    expect(recipients).toContainEqual({
      authUserId: anonymous.authUserId,
      email: null,
    });
  });

  it('returns one row per account when the same person holds two member rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const processProfileId = setup.instance.profileId;

    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    // Two member rows, written at different times with different snapshots —
    // exactly the shape that used to mail one person twice.
    for (const email of [`old-${member.email}`, `newer-${member.email}`]) {
      await writeStaleSnapshot({
        profileId: processProfileId,
        authUserId: member.authUserId,
        email,
      });
    }

    const recipients = await listProfileRecipients({
      profileId: processProfileId,
    });

    expect(
      recipients.filter(({ authUserId }) => authUserId === member.authUserId),
    ).toEqual([{ authUserId: member.authUserId, email: member.email }]);
  });

  it("addresses an individual profile through its owner's account", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup();

    // An individual profile carries no profileUsers row at all, so the
    // members-only lookup used to find nothing and send no mail.
    const member = await testData.createMemberUser({
      organization: setup.organization,
    });

    await expect(
      listProfileRecipients({ profileId: member.profileId }),
    ).resolves.toEqual([
      { authUserId: member.authUserId, email: member.email },
    ]);
  });
});

describe.concurrent('listUserRecipient', () => {
  it("resolves a users row to its account's sign-in address", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup();

    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    // public.users.email is a mirror whose trigger has never fired.
    const [userRow] = await db
      .update(users)
      .set({ email: `stale-${member.email}` })
      .where(eq(users.authUserId, member.authUserId))
      .returning({ id: users.id });

    if (!userRow) {
      throw new Error(`No users row for ${member.email}`);
    }

    await expect(listUserRecipient({ userId: userRow.id })).resolves.toEqual({
      authUserId: member.authUserId,
      email: member.email,
    });
  });
});

describe.concurrent('listOrganizationAdminRecipients', () => {
  it('addresses the admins of an organization and no one else', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUsers, memberUsers } =
      await testData.createOrganization({ users: { admin: 1, member: 1 } });

    const recipients = await listOrganizationAdminRecipients({
      organizationId: organization.id,
    });
    const addresses = recipients.map(({ email }) => email);

    for (const admin of adminUsers) {
      expect(addresses).toContain(admin.email);
    }
    for (const member of memberUsers) {
      expect(addresses).not.toContain(member.email);
    }
  });
});
