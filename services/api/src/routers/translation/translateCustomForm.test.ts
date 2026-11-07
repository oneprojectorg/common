import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { contentTranslations, customForms } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { mockTranslateText } from '../../test/mocks/deepl';
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

async function attachForm({
  profileId,
  schema,
  onTestFinished,
}: {
  profileId: string;
  schema: Record<string, unknown>;
  onTestFinished: (fn: () => Promise<void>) => void;
}) {
  const [form] = await db
    .insert(customForms)
    .values({ profileId, name: 'Applicant details', schema })
    .returning();

  if (!form) {
    throw new Error('Test setup: failed to create custom form');
  }

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `custom_form:${form.id}:%`));
    await db.delete(customForms).where(eq(customForms.id, form.id));
  });

  return form;
}

describe('translation.translateCustomForm', () => {
  it('translates the form title, description, field text and choice labels', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm({
      profileId: setup.instance.profileId,
      onTestFinished,
      schema: {
        type: 'object',
        title: 'About you',
        description: 'Tell us more.',
        properties: {
          role: {
            type: 'string',
            title: 'Your role',
            description: 'Pick one.',
            enum: ['Farmer', 'Teacher'],
          },
          interests: {
            type: 'array',
            title: 'Interests',
            items: { type: 'string', enum: ['Food', 'Water', 'Tier[2]'] },
          },
          tier: {
            type: 'string',
            oneOf: [{ const: 'gold', title: 'Gold tier' }],
          },
          age: { type: 'integer' },
        },
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translateCustomForm({
      customFormId: form.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      translated: {
        title: '[ES] About you',
        description: '[ES] Tell us more.',
        'field_title:role': '[ES] Your role',
        'field_desc:role': '[ES] Pick one.',
        'option:role:Farmer': '[ES] Farmer',
        'option:role:Teacher': '[ES] Teacher',
        'field_title:interests': '[ES] Interests',
        'option:interests:Food': '[ES] Food',
        'option:interests:Water': '[ES] Water',
        'option:interests:Tier[2]': '[ES] Tier[2]',
        'option:tier:gold': '[ES] Gold tier',
      },
      sourceLocale: 'EN',
      targetLocale: 'es',
    });
  });

  it('serves a repeat request from the translation cache', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm({
      profileId: setup.instance.profileId,
      onTestFinished,
      schema: { type: 'object', title: 'About you', properties: {} },
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const input = { customFormId: form.id, targetLocale: 'es' as const };

    await caller.translation.translateCustomForm(input);
    mockTranslateText.mockClear();
    const result = await caller.translation.translateCustomForm(input);

    expect(result.translated).toEqual({ title: '[ES] About you' });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects a stored definition the form renderer cannot read', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    // Seeded directly: `createCustomForm` rejects this definition at write.
    const form = await attachForm({
      profileId: setup.instance.profileId,
      onTestFinished,
      schema: { type: 'string', title: 'About you' },
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.translation.translateCustomForm({
        customFormId: form.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('returns an empty translation without calling the provider when the form has no text', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm({
      profileId: setup.instance.profileId,
      onTestFinished,
      schema: { type: 'object', properties: { age: { type: 'integer' } } },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translateCustomForm({
      customFormId: form.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      translated: {},
      sourceLocale: '',
      targetLocale: 'es',
    });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects a deleted form', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm({
      profileId: setup.instance.profileId,
      onTestFinished,
      schema: { type: 'object', title: 'About you', properties: {} },
    });
    await db
      .update(customForms)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(customForms.id, form.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.translation.translateCustomForm({
        customFormId: form.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeAccessTierGating('translation.translateCustomForm', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.translation.translateCustomForm({
        customFormId: crypto.randomUUID(),
        targetLocale: 'es',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateCustomForm({
          customFormId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateCustomForm({
          customFormId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateCustomForm({
          customFormId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),
});
