import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describe.concurrent('updateUserProfile', () => {
  it('busts the cached user so getMyAccount serves the update immediately', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ grantAccess: true });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Warm the type:'user' cache, then mutate: updateUserProfile must
    // invalidate it or the next getMyAccount serves the stale profile name
    // (the "Logged in as <old name>" bug).
    const before = await caller.account.getMyAccount();
    expect(before?.profile?.name).toBeDefined();

    const newName = `Renamed ${task.id}`;
    await caller.account.updateUserProfile({ name: newName });

    const after = await caller.account.getMyAccount();
    expect(after?.profile?.name).toBe(newName);
  });
});

describeAccessTierGating('account.updateUserProfile', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.updateUserProfile({}),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.account.updateUserProfile({}),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.account.updateUserProfile({}));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.account.updateUserProfile({}));
    },
  ),
});
