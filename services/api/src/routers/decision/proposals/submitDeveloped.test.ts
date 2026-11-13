import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { ProposalStatus, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('submitDevelopedProposal', () => {
  it('lets the author, a caller with Develop Proposals and no Submit bit, submit the draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const developer = await createDevelopProposalsMember({
      testData,
      setup,
    });
    const caller = await createAuthenticatedCaller(developer.email);
    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    const submitted = await caller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });

    expect(submitted.id).toBe(draft.id);
    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
    expect(submitted.shortCode).not.toBeNull();
  });

  it('refuses a caller with Develop Proposals who is not an author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [author, otherDeveloper] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    const [authorCaller, otherCaller] = await Promise.all([
      createAuthenticatedCaller(author.email),
      createAuthenticatedCaller(otherDeveloper.email),
    ]);
    const draft = await authorCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(
      otherCaller.decision.submitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject({
      cause: {
        name: 'UnauthorizedError',
        message: expect.stringContaining('Only an author'),
      },
    });
  });

  it('refuses a draft with no developed edge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const ordinaryDraft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Ordinary' },
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitDevelopedProposal({ proposalId: ordinaryDraft.id }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringContaining('not developed'),
      },
    });
  });

  it.for([
    { name: 'soft-deleted', column: 'deletedAt' },
    { name: 'moderation-detached', column: 'moderationDetachedAt' },
  ] as const)(
    'refuses a $name developed draft as not found',
    async ({ column }, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId, source } = await createDevelopPhaseSetup({
        testData,
      });
      const developer = await createDevelopProposalsMember({
        testData,
        setup,
      });
      const caller = await createAuthenticatedCaller(developer.email);
      const draft = await caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      });
      testData.trackProfileForCleanup(draft.profileId);
      await db
        .update(proposals)
        .set({ [column]: new Date().toISOString() })
        .where(eq(proposals.id, draft.id));

      await expect(
        caller.decision.submitDevelopedProposal({ proposalId: draft.id }),
      ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    },
  );
});
