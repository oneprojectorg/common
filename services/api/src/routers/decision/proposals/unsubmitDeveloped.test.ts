import {
  TestDecisionsDataManager,
  createDecisionsAdmin,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { ProposalStatus, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
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

describe.concurrent('unsubmitDevelopedProposal', () => {
  it('moves the author’s advanced entry back to draft and keeps its short code', async ({
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

    const unsubmitted = await caller.decision.unsubmitDevelopedProposal({
      proposalId: draft.id,
    });

    expect(unsubmitted.id).toBe(draft.id);
    expect(unsubmitted.status).toBe(ProposalStatus.DRAFT);
    expect(unsubmitted.shortCode).toBe(submitted.shortCode);
    const stored = await db.query.proposals.findFirst({
      where: { id: draft.id },
      columns: { status: true, shortCode: true },
    });
    expect(stored).toEqual({
      status: ProposalStatus.DRAFT,
      shortCode: submitted.shortCode,
    });
  });

  it('lets the author advance the entry again with the same short code', async ({
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
    const firstSubmit = await caller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });
    await caller.decision.unsubmitDevelopedProposal({ proposalId: draft.id });

    const secondSubmit = await caller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });

    expect(secondSubmit.status).toBe(ProposalStatus.SUBMITTED);
    expect(firstSubmit.shortCode).not.toBeNull();
    expect(secondSubmit.shortCode).toBe(firstSubmit.shortCode);
  });

  it('refuses an entry that is still a draft', async ({
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

    await expect(
      caller.decision.unsubmitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });
  });

  it('lets an admin of the decision who is not the creator move the advanced entry back to draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [developer, decisionsAdmin] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDecisionsAdmin({ testData, setup }),
    ]);
    const [developerCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(developer.email),
      createAuthenticatedCaller(decisionsAdmin.email),
    ]);
    const draft = await developerCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);
    await developerCaller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });

    const unsubmitted = await adminCaller.decision.unsubmitDevelopedProposal({
      proposalId: draft.id,
    });

    expect(unsubmitted.status).toBe(ProposalStatus.DRAFT);
  });

  it('refuses a caller with Develop Proposals who is not an author and leaves the entry advanced', async ({
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
    await authorCaller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });

    await expect(
      otherCaller.decision.unsubmitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject({
      cause: {
        name: 'UnauthorizedError',
        message: expect.stringContaining('Only an author'),
      },
    });
    const stored = await db.query.proposals.findFirst({
      where: { id: draft.id },
      columns: { status: true },
    });
    expect(stored?.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('refuses a soft-deleted entry as not found', async ({
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
    await caller.decision.submitDevelopedProposal({ proposalId: draft.id });
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, draft.id));

    await expect(
      caller.decision.unsubmitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeAccessTierGating('unsubmitDevelopedProposal', {
  noJwt: accessTierGatingCell(
    'rejects a no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.unsubmitDevelopedProposal({ proposalId: randomUUID() }),
        'none',
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'rejects an anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.unsubmitDevelopedProposal({ proposalId: randomUUID() }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects a user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.unsubmitDevelopedProposal({ proposalId: randomUUID() }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits a network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.unsubmitDevelopedProposal({ proposalId: randomUUID() }),
      );
    },
  ),
});
