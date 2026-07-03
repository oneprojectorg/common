import { db, eq } from '@op/db/client';
import { customForms } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('customForm.getForProfile', () => {
  it('returns the form attached to a profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const [form] = await db
      .insert(customForms)
      .values({
        profileId: setup.instance.profileId,
        name: 'Attached Form',
        schema: { type: 'object', properties: {} },
      })
      .returning();

    if (!form) {
      throw new Error('Test setup: failed to create custom form');
    }
    onTestFinished(async () => {
      await db.delete(customForms).where(eq(customForms.id, form.id));
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.customForm.getForProfile({
      profileId: setup.instance.profileId,
    });

    expect(result?.id).toBe(form.id);
    expect(result?.name).toBe('Attached Form');
  });

  it('returns null when no form is attached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.customForm.getForProfile({
      profileId: setup.instance.profileId,
    });

    expect(result).toBeNull();
  });
});

describeAccessTierGating('customForm.getForProfile', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.getForProfile({
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.customForm.getForProfile({
          profileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.getForProfile({
          profileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.getForProfile({
          profileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});
