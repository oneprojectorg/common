import { TestProfileUserDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from './notificationPreferences';

const allOn = {
  proposalsAndComments: { email: true, sms: true },
  thingsYouFollow: { email: true, sms: true },
  processUpdates: { email: true, sms: true },
  relationshipRequests: { email: true, sms: true },
};

const readStoredPreferences = async (authUserId: string) => {
  const [row] = await db
    .select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return row?.notificationPreferences;
};

describe.concurrent('notificationPreferences', () => {
  it('given a member who never saved a preference, when they read, then the row holds nothing and every channel resolves to on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId } = await testData.createStandaloneUser();

    await expect(getNotificationPreferences({ authUserId })).resolves.toEqual(
      allOn,
    );
    await expect(readStoredPreferences(authUserId)).resolves.toBeNull();
  });

  it('given a member turns one channel off, when the row is read back, then it stores only that channel', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId } = await testData.createStandaloneUser();

    const resolved = await updateNotificationPreferences({
      authUserId,
      patch: { processUpdates: { sms: false } },
    });

    expect(resolved).toEqual({
      ...allOn,
      processUpdates: { email: true, sms: false },
    });
    await expect(readStoredPreferences(authUserId)).resolves.toEqual({
      processUpdates: { sms: false },
    });
  });

  it('given a channel is off, when the member turns it back on, then the row stores an explicit on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId } = await testData.createStandaloneUser();

    await updateNotificationPreferences({
      authUserId,
      patch: { thingsYouFollow: { email: false } },
    });
    const resolved = await updateNotificationPreferences({
      authUserId,
      patch: { thingsYouFollow: { email: true } },
    });

    expect(resolved).toEqual(allOn);
    await expect(readStoredPreferences(authUserId)).resolves.toEqual({
      thingsYouFollow: { email: true },
    });
  });

  it('given saved preferences, when a later patch touches other categories, then the earlier ones survive the merge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId } = await testData.createStandaloneUser();

    await updateNotificationPreferences({
      authUserId,
      patch: { proposalsAndComments: { sms: false } },
    });
    await updateNotificationPreferences({
      authUserId,
      patch: { relationshipRequests: { email: false, sms: false } },
    });
    const resolved = await updateNotificationPreferences({
      authUserId,
      patch: { proposalsAndComments: { email: false } },
    });

    expect(resolved).toEqual({
      ...allOn,
      proposalsAndComments: { email: false, sms: false },
      relationshipRequests: { email: false, sms: false },
    });
    await expect(readStoredPreferences(authUserId)).resolves.toEqual({
      proposalsAndComments: { email: false, sms: false },
      relationshipRequests: { email: false, sms: false },
    });
    await expect(getNotificationPreferences({ authUserId })).resolves.toEqual(
      resolved,
    );
  });

  it('given a patch that names a category with no channels, when it is saved, then the row stays empty', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId } = await testData.createStandaloneUser();

    const resolved = await updateNotificationPreferences({
      authUserId,
      patch: { processUpdates: {} },
    });

    expect(resolved).toEqual(allOn);
    await expect(readStoredPreferences(authUserId)).resolves.toEqual({});
  });

  it('given two members, when one turns a channel off, then the other still reads every channel on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const first = await testData.createStandaloneUser();
    const second = await testData.createStandaloneUser();

    await updateNotificationPreferences({
      authUserId: first.authUserId,
      patch: { processUpdates: { email: false } },
    });

    await expect(
      getNotificationPreferences({ authUserId: second.authUserId }),
    ).resolves.toEqual(allOn);
    await expect(readStoredPreferences(second.authUserId)).resolves.toBeNull();
  });

  it('given an auth user id with no user row, when preferences are read, then the call fails as not found', async () => {
    await expect(
      getNotificationPreferences({ authUserId: randomUUID() }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('given an auth user id with no user row, when preferences are updated, then the call fails as not found and no row is written', async () => {
    const authUserId = randomUUID();

    await expect(
      updateNotificationPreferences({
        authUserId,
        patch: { processUpdates: { sms: false } },
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(readStoredPreferences(authUserId)).resolves.toBeUndefined();
  });
});
