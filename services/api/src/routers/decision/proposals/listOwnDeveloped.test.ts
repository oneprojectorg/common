import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
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

describe.concurrent('listOwnDevelopedProposals', () => {
  it("lists the caller's own developed drafts and submitted proposals with their origins, and nobody else's", async ({
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
    const [authorCaller, otherCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(author.email),
      createAuthenticatedCaller(otherDeveloper.email),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const createEntry = async (caller: typeof authorCaller, title: string) => {
      const entry = await caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title },
      });
      testData.trackProfileForCleanup(entry.profileId);
      return entry;
    };

    const draft = await createEntry(authorCaller, 'Draft entry');
    const ready = await createEntry(authorCaller, 'Ready entry');
    await authorCaller.decision.submitDevelopedProposal({
      proposalId: ready.id,
    });
    const othersEntry = await createEntry(otherCaller, 'Other entry');
    // A proposal with no developed edge is not an entry, so the admin, who
    // authored only this one, lists nothing.
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Ordinary' },
    });

    const [own, others, admins] = await Promise.all([
      authorCaller.decision.listOwnDevelopedProposals({
        processInstanceId: instanceId,
      }),
      otherCaller.decision.listOwnDevelopedProposals({
        processInstanceId: instanceId,
      }),
      adminCaller.decision.listOwnDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ]);

    expect(own.items).toEqual([
      expect.objectContaining({
        id: ready.id,
        status: ProposalStatus.SUBMITTED,
        title: 'Ready entry',
        origins: [{ id: source.id, name: 'Source' }],
      }),
      expect.objectContaining({
        id: draft.id,
        status: ProposalStatus.DRAFT,
        title: 'Draft entry',
        origins: [{ id: source.id, name: 'Source' }],
      }),
    ]);
    expect(others.items.map((item) => item.id)).toEqual([othersEntry.id]);
    expect(admins.items).toEqual([]);
  });

  it('refuses a caller with no role on the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
    });
    const caller = await createAuthenticatedCaller(outsider.email);

    await expect(
      caller.decision.listOwnDevelopedProposals({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
