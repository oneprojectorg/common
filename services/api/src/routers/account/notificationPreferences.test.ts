import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

const allOn = {
  proposalsAndComments: { email: true, sms: true },
  thingsYouFollow: { email: true, sms: true },
  processUpdates: { email: true, sms: true },
  relationshipRequests: { email: true, sms: true },
};

describe.concurrent('account.notificationPreferences', () => {
  it('given a user who never saved preferences, when they read them, then every channel is on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(caller.account.getNotificationPreferences()).resolves.toEqual(
      allOn,
    );
  });

  it('given a user turns one channel off, when they read preferences again, then only that channel is off', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const updated = await caller.account.updateNotificationPreferences({
      processUpdates: { sms: false },
    });
    expect(updated).toEqual({
      ...allOn,
      processUpdates: { email: true, sms: false },
    });

    await expect(caller.account.getNotificationPreferences()).resolves.toEqual(
      updated,
    );
  });

  it('given a saved preference, when a second update touches another category, then the first preference is kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.account.updateNotificationPreferences({
      thingsYouFollow: { email: false },
    });
    const updated = await caller.account.updateNotificationPreferences({
      relationshipRequests: { email: false, sms: false },
    });

    expect(updated).toEqual({
      ...allOn,
      thingsYouFollow: { email: false, sms: true },
      relationshipRequests: { email: false, sms: false },
    });
  });

  it('given a patch with an unknown category, when it is sent, then the category is dropped and nothing is stored', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.account.updateNotificationPreferences(
        JSON.parse('{"marketing":{"email":false}}'),
      ),
    ).resolves.toEqual(allOn);

    await expect(caller.account.getNotificationPreferences()).resolves.toEqual(
      allOn,
    );
  });

  it('given a patch whose channel value is not a boolean, when it is sent, then the call fails as bad request and nothing is stored', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.account.updateNotificationPreferences(
        JSON.parse('{"processUpdates":{"sms":"off"}}'),
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(caller.account.getNotificationPreferences()).resolves.toEqual(
      allOn,
    );
  });

  it('given two members, when one turns a channel off, then the other still reads every channel on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const first = await testData.createDecisionSetup({ grantAccess: true });
    const second = await testData.createDecisionSetup({ grantAccess: true });
    const firstCaller = await createAuthenticatedCaller(first.userEmail);
    const secondCaller = await createAuthenticatedCaller(second.userEmail);

    await firstCaller.account.updateNotificationPreferences({
      proposalsAndComments: { email: false },
    });

    await expect(
      secondCaller.account.getNotificationPreferences(),
    ).resolves.toEqual(allOn);
  });
});

describeAccessTierGating('account.getNotificationPreferences', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.getNotificationPreferences(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.account.getNotificationPreferences(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.account.getNotificationPreferences(),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.account.getNotificationPreferences(),
      );
    },
  ),
});

describeAccessTierGating('account.updateNotificationPreferences', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.updateNotificationPreferences({}),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.account.updateNotificationPreferences({}),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.account.updateNotificationPreferences({}),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.account.updateNotificationPreferences({}),
      );
    },
  ),
});
