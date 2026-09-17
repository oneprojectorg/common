import jwt from 'jsonwebtoken';
import { createPublicKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
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

const TIPTAP_PUBLIC_KEY = createPublicKey(process.env.TIPTAP_PRIVATE_KEY ?? '');
const TIPTAP_ENVIRONMENT_ID = 'test-tiptap-env';

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

function decodeCollabToken(token: string) {
  const payload = jwt.verify(token, TIPTAP_PUBLIC_KEY, {
    algorithms: ['ES256'],
    issuer: TIPTAP_ENVIRONMENT_ID,
    audience: 'Documents',
  });

  if (typeof payload === 'string') {
    throw new Error('Expected a decoded JWT payload, got a string');
  }

  return payload;
}

describe.concurrent('decision.getCollabToken', () => {
  it('issues a document-scoped token to the proposal author', async ({
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
      proposalData: { title: 'Test Proposal' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId?: string;
    };

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const { token } = await caller.decision.getCollabToken({
      proposalProfileId: proposal.profileId,
    });

    const payload = decodeCollabToken(token);

    expect(payload.sub).toBe(setup.user.id);
    expect(payload.permissions).toEqual([
      { action: 'Documents:Write', resource: collaborationDocId },
    ]);
  });

  it('refuses an authenticated user with no standing on the process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    const outsider = await profileData.createStandaloneUser();
    const caller = await createAuthenticatedCaller(outsider.email);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('404s an unknown proposal profile id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a proposal that has no collaboration document', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    // A `description` makes the helper write legacy data with no doc id.
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Legacy Proposal', description: 'No collab doc' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getCollabToken({
        proposalProfileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describeAccessTierGating('decision.getCollabToken', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.getCollabToken({
        proposalProfileId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.getCollabToken({
          proposalProfileId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});
