import { db, eq } from '@op/db/client';
import { customFormSubmissions, customForms } from '@op/db/schema';
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

const TEST_FORM_SCHEMA = {
  type: 'object',
  required: ['neighborhood'],
  properties: {
    neighborhood: { type: 'string' },
    agreeToTerms: { type: 'boolean' },
  },
};

async function createCustomForm(
  profileId: string,
  onTestFinished: (fn: () => Promise<void>) => void,
) {
  const [form] = await db
    .insert(customForms)
    .values({
      profileId,
      name: 'Test Form',
      schema: TEST_FORM_SCHEMA,
    })
    .returning();

  if (!form) {
    throw new Error('Test setup: failed to create custom form');
  }

  onTestFinished(async () => {
    await db.delete(customForms).where(eq(customForms.id, form.id));
  });

  return form;
}

describe.concurrent('customForm.submit', () => {
  it('records a submission for the proposal owner', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await createCustomForm(
      setup.instance.profileId,
      onTestFinished,
    );
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Owner submits form' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const submission = await caller.customForm.submit({
      customFormId: form.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Downtown', agreeToTerms: true },
    });

    expect(submission.customFormId).toBe(form.id);
    expect(submission.profileId).toBe(proposal.profileId);
    expect(submission.data).toMatchObject({ neighborhood: 'Downtown' });
  });

  it('is idempotent per form and profile — a retry updates, not duplicates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await createCustomForm(
      setup.instance.profileId,
      onTestFinished,
    );
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Retry does not duplicate' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.customForm.submit({
      customFormId: form.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Downtown' },
    });
    const second = await caller.customForm.submit({
      customFormId: form.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Linden' },
    });

    expect(second.data).toMatchObject({ neighborhood: 'Linden' });

    const rows = await db
      .select()
      .from(customFormSubmissions)
      .where(eq(customFormSubmissions.customFormId, form.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toMatchObject({ neighborhood: 'Linden' });
  });

  it('rejects data that fails the form schema', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await createCustomForm(
      setup.instance.profileId,
      onTestFinished,
    );
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Invalid data rejected' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.customForm.submit({
        customFormId: form.id,
        profileId: proposal.profileId,
        // Missing required `neighborhood`
        data: { agreeToTerms: true },
      }),
    ).rejects.toThrow(/validation failed/i);
  });

  it('rejects a caller without access to the target profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [owner, outsider] = await Promise.all([
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
    ]);
    const form = await createCustomForm(
      owner.instance.profileId,
      onTestFinished,
    );
    const proposal = await testData.createProposal({
      userEmail: owner.userEmail,
      processInstanceId: owner.instance.instance.id,
      proposalData: { title: 'Outsider cannot attach here' },
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.userEmail);

    await expect(
      outsiderCaller.customForm.submit({
        customFormId: form.id,
        profileId: proposal.profileId,
        data: { neighborhood: 'Downtown' },
      }),
    ).rejects.toThrow(/do not have access/i);
  });

  it('rejects a target proposal that does not belong to the form', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [formSide, proposalSide] = await Promise.all([
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
      testData.createDecisionSetup({ instanceCount: 1, grantAccess: true }),
    ]);
    // Form lives on decision A; the target proposal lives in decision B.
    const form = await createCustomForm(
      formSide.instance.profileId,
      onTestFinished,
    );
    const proposal = await testData.createProposal({
      userEmail: proposalSide.userEmail,
      processInstanceId: proposalSide.instance.instance.id,
      proposalData: { title: 'Wrong process for this form' },
    });

    const caller = await createAuthenticatedCaller(proposalSide.userEmail);

    await expect(
      caller.customForm.submit({
        customFormId: form.id,
        profileId: proposal.profileId,
        data: { neighborhood: 'Downtown' },
      }),
    ).rejects.toThrow(/does not belong to this form/i);
  });
});

describeAccessTierGating('customForm.submit', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.submit({
        customFormId: '00000000-0000-0000-0000-000000000000',
        profileId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.customForm.submit({
          customFormId: '00000000-0000-0000-0000-000000000000',
          profileId: '00000000-0000-0000-0000-000000000000',
          data: {},
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.submit({
          customFormId: '00000000-0000-0000-0000-000000000000',
          profileId: '00000000-0000-0000-0000-000000000000',
          data: {},
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.submit({
          customFormId: '00000000-0000-0000-0000-000000000000',
          profileId: '00000000-0000-0000-0000-000000000000',
          data: {},
        }),
      );
    },
  ),
});
