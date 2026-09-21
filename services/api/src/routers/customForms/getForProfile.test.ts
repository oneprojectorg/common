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

async function attachForm(
  profileId: string,
  onTestFinished: (fn: () => Promise<void>) => void,
  phaseId?: string,
) {
  const [form] = await db
    .insert(customForms)
    .values({
      profileId,
      name: phaseId ? `Attached Form (${phaseId})` : 'Attached Form',
      schema: {
        type: 'object',
        properties: {},
        ...(phaseId ? { 'x-phase': phaseId } : {}),
      },
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

    const form = await attachForm(setup.instance.profileId, onTestFinished);

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

  it('stops returning a form the caller answered on their own proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm(setup.instance.profileId, onTestFinished);
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Answered once' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.customForm.submit({
      customFormId: form.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Downtown' },
    });

    // The submission is attached to the proposal, not to the author — the read
    // has to resolve it back to the person before it can stop asking.
    await expect(
      caller.customForm.getForProfile({
        profileId: setup.instance.profileId,
      }),
    ).resolves.toBeNull();
  });

  it('stops returning a form the caller answered on their own profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm(setup.instance.profileId, onTestFinished);

    const userRecord = await db.query.users.findFirst({
      where: { authUserId: setup.user.id },
      columns: { profileId: true },
    });

    if (!userRecord?.profileId) {
      throw new Error('Test setup: user has no individual profile');
    }

    // Written directly rather than through `customForm.submit`: attaching to
    // one's own profile is the post-vote path, and the read under test doesn't
    // care how the row got there — only whose it is.
    await db.insert(customFormSubmissions).values({
      customFormId: form.id,
      profileId: userRecord.profileId,
      data: { neighborhood: 'Downtown' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.customForm.getForProfile({
        profileId: setup.instance.profileId,
      }),
    ).resolves.toBeNull();
  });

  it('still asks the next phase after the caller answered this one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const submissionForm = await attachForm(
      setup.instance.profileId,
      onTestFinished,
      'submission',
    );
    const votingForm = await attachForm(
      setup.instance.profileId,
      onTestFinished,
      'voting',
    );
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Answered the submission phase only' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.customForm.submit({
      customFormId: submissionForm.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Downtown' },
    });

    const [submissionPhase, votingPhase] = await Promise.all([
      caller.customForm.getForProfile({
        profileId: setup.instance.profileId,
        phaseId: 'submission',
      }),
      caller.customForm.getForProfile({
        profileId: setup.instance.profileId,
        phaseId: 'voting',
      }),
    ]);

    expect(submissionPhase).toBeNull();
    expect(votingPhase?.id).toBe(votingForm.id);
  });

  it('still returns the form to a participant who has not answered', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const form = await attachForm(setup.instance.profileId, onTestFinished);
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Only the author answered' },
    });

    const author = await createAuthenticatedCaller(setup.userEmail);
    await author.customForm.submit({
      customFormId: form.id,
      profileId: proposal.profileId,
      data: { neighborhood: 'Downtown' },
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const result = await memberCaller.customForm.getForProfile({
      profileId: setup.instance.profileId,
    });

    expect(result?.id).toBe(form.id);
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
