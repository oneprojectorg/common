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

describe.concurrent('signProposalAttachmentUploadUrl', () => {
  it('issues a signed upload URL for a user with proposal permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.signProposalAttachmentUploadUrl({
      proposalId: proposal.id,
      fileName: 'photo.jpg',
    });

    expect(result.signedUrl).toMatch(/^https?:\/\//);
    expect(result.token).toBeTruthy();
    expect(result.storagePath).toMatch(
      /\/proposals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_photo\.jpg$/,
    );
  });

  it('rejects a user without proposal permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setupA = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const proposal = await testData.createProposal({
      userEmail: setupA.userEmail,
      processInstanceId: setupA.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const setupB = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });
    const outsiderCaller = await createAuthenticatedCaller(setupB.userEmail);

    await expect(
      outsiderCaller.decision.signProposalAttachmentUploadUrl({
        proposalId: proposal.id,
        fileName: 'photo.jpg',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

describeAccessTierGating('signProposalAttachmentUploadUrl', {
  noJwt: accessTierGatingCell(
    'rejects no-JWT caller',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'no-JWT should not reach this' },
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.signProposalAttachmentUploadUrl({
          proposalId: proposal.id,
          fileName: 'no-jwt.png',
        }),
        'none',
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'anon gets past the gate' },
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.signProposalAttachmentUploadUrl({
          proposalId: proposal.id,
          fileName: 'anon.png',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'out-of-network user gets past the gate' },
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.signProposalAttachmentUploadUrl({
          proposalId: proposal.id,
          fileName: 'user.png',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Common-JWT owner signs' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.signProposalAttachmentUploadUrl({
        proposalId: proposal.id,
        fileName: 'common.png',
      });
      expect(result.signedUrl).toMatch(/^https?:\/\//);
    },
  ),
});
