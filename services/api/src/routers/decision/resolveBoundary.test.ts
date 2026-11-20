import { TestDecisionsDataManager } from '@op/common/testing';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

const input = { lat: 40.7128, lng: -74.006, profileId: randomUUID() };

// resolveBoundary is an `authenticatedProcedure`: only the editable picker calls
// it (composing a proposal requires a session — anonymous Supabase included), so
// any authenticated tier is admitted and only a no-JWT caller is rejected.
describeAccessTierGating('decision.resolveBoundary', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.resolveBoundary(input),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),
});

describe.concurrent('decision.resolveBoundary authorization', () => {
  it('rejects a caller who cannot read the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const decision = await testData.createDecisionSetup({ instanceCount: 1 });
    const outsider = await testData.createDecisionSetup();
    const caller = await createAuthenticatedCaller(outsider.userEmail);

    await expect(
      caller.decision.resolveBoundary({
        ...input,
        profileId: decision.instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('admits an admin of the owning organization without a decision role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const decision = await testData.createDecisionSetup({ instanceCount: 1 });
    const caller = await createAuthenticatedCaller(decision.userEmail);

    await expect(
      caller.decision.resolveBoundary({
        ...input,
        profileId: decision.instance.profileId,
      }),
    ).resolves.toEqual({ boundary: null, boundariesConfigured: false });
  });

  it('admits any caller on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const decision = await testData.createDecisionSetup({ instanceCount: 1 });
    await testData.makeDecisionPublic(decision.instance.profileId);
    const outsider = await testData.createDecisionSetup();
    const caller = await createAuthenticatedCaller(outsider.userEmail);

    await expect(
      caller.decision.resolveBoundary({
        ...input,
        profileId: decision.instance.profileId,
      }),
    ).resolves.toEqual({ boundary: null, boundariesConfigured: false });
  });
});
