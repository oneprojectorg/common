import { cache } from '@op/cache';
import {
  TestDecisionsDataManager,
  ensureProposalCategoryTerms,
} from '@op/common/testing';
import { createDecisionBoundary } from '@op/common/testing/data';
import {
  ProposalStatus,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  const caller = createCaller(await createTestContextWithSession(session));
  return { caller, session };
}

const readCachedUser = ({
  authUserId,
  fresh,
}: {
  authUserId: string;
  fresh: string;
}) => cache({ type: 'user', params: [authUserId], fetch: async () => fresh });

describe.concurrent('createProposal', () => {
  it('drops the cached access of the author so their admin role on the proposal applies at once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { caller, session } = await createAuthenticatedCaller(
      setup.userEmail,
    );
    // A `user` entry cached before the membership exists.
    await readCachedUser({ authUserId: session.user.id, fresh: 'stale' });

    const proposal = await caller.decision.createProposal({
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Cache Proposal' },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    expect(
      await readCachedUser({ authUserId: session.user.id, fresh: 'fresh' }),
    ).toBe('fresh');
  });

  it('links the categories that match a proposal taxonomy term and drops the rest', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const [knownTerm] = await ensureProposalCategoryTerms([`Known ${task.id}`]);
    if (!knownTerm) {
      throw new Error('Failed to seed a proposal category term');
    }
    const { caller } = await createAuthenticatedCaller(setup.userEmail);

    const proposal = await caller.decision.createProposal({
      processInstanceId: setup.instance.instance.id,
      proposalData: {
        title: 'Categorised Proposal',
        category: [knownTerm.label, `Unknown ${task.id}`],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    const links = await db
      .select({ taxonomyTermId: proposalCategories.taxonomyTermId })
      .from(proposalCategories)
      .where(eq(proposalCategories.proposalId, proposal.id));

    expect(links).toEqual([{ taxonomyTermId: knownTerm.taxonomyTermId }]);
  });

  it('links the district category of the boundary that holds the location', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceProfileId = setup.instance.instance.profileId;
    if (!instanceProfileId) {
      throw new Error('Instance has no profile');
    }
    const [districtTerm] = await ensureProposalCategoryTerms([
      `District ${task.id}`,
    ]);
    if (!districtTerm) {
      throw new Error('Failed to seed a proposal category term');
    }
    onTestFinished(async () => {
      await db
        .delete(taxonomyTerms)
        .where(eq(taxonomyTerms.id, districtTerm.taxonomyTermId));
    });
    await createDecisionBoundary({
      profileId: instanceProfileId,
      name: districtTerm.label,
      taxonomyTermId: districtTerm.taxonomyTermId,
    });
    const { caller } = await createAuthenticatedCaller(setup.userEmail);

    const proposal = await caller.decision.createProposal({
      processInstanceId: setup.instance.instance.id,
      proposalData: {
        title: 'Located Proposal',
        location: { lat: 40.5, lng: -73.5 },
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    const links = await db
      .select({ taxonomyTermId: proposalCategories.taxonomyTermId })
      .from(proposalCategories)
      .where(eq(proposalCategories.proposalId, proposal.id));

    expect(links).toEqual([{ taxonomyTermId: districtTerm.taxonomyTermId }]);
    expect(proposal.proposalData).toMatchObject({
      category: [districtTerm.label],
    });
  });
});

describeDecisionAccessTierGating('createProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Should reject no-JWT create' },
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Non-public; anon should bounce' },
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Non-public; anon should bounce' },
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Created by common admin on non-public instance',
        },
      });

      expect(result.status).toBe(ProposalStatus.DRAFT);
      if (result.profileId) {
        testData.trackProfileForCleanup(result.profileId);
      }
    },
  ),
});
