import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createIsolatedTestClient,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createAnonymousCaller() {
  const client = createIsolatedTestClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Failed to sign in anonymously: ${error?.message}`);
  }
  return createCaller(await createTestContextWithSession(data.session));
}

describe.concurrent('getInstance', () => {
  it('should return full access for a profile admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // grantAccess: true uses isAdmin=true which assigns the Admin role (profile.ADMIN)
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.access?.admin).toBe(true);
    expect(result.access?.submitProposals).toBe(true);
    expect(result.access?.vote).toBe(true);
  });

  it('should return limited access for a member (non-admin) user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Member role has decisions.SUBMIT_PROPOSALS and decisions.VOTE but not admin
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.access?.admin).toBe(false);
    expect(result.access?.submitProposals).toBe(true);
    expect(result.access?.vote).toBe(true);
  });

  it('should return NOT_FOUND for a non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getInstance({
        instanceId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 404 } });
  });

  it('should return FORBIDDEN for a user with no access to the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a user in a completely separate org — org-level fallback would grant READ
    // to members of the same org, so we must use a different org to test true unauthorized access
    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.decision.getInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });
  });

  it('should exclude draft proposals from stats', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const draftProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Draft proposal',
        description: 'Still drafting',
      },
    });

    const submittedProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Submitted proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const submittedResult = await caller.decision.submitProposal({
      proposalId: submittedProposal.id,
    });

    expect(draftProposal.status).toBe(ProposalStatus.DRAFT);
    expect(submittedResult.status).toBe(ProposalStatus.SUBMITTED);

    const result = await caller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.proposalCount).toBe(1);
    expect(result.participantCount).toBe(1);
  });

  // Public-mode gating: getInstance should admit no-JWT and anon-JWT
  // callers on instances seeded with the PUBLIC / ANONYMOUS roles, and
  // reject both on non-public instances. Mirrors gating tests on
  // getDecisionBySlug / listProposals / createProposal.
  describe('public-mode gating', () => {
    it('allows a no-JWT caller to read a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      await testData.setInstancePublic(instance.instance.id);

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      const result = await noJwtCaller.decision.getInstance({
        instanceId: instance.instance.id,
      });

      expect(result.id).toBe(instance.instance.id);
      // PUBLIC role grants `decisions: READ` only.
      expect(result.access?.read).toBe(true);
      expect(result.access?.admin).toBe(false);
    });

    it('allows an anonymous JWT to read a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      await testData.setInstancePublic(instance.instance.id);

      const anonCaller = await createAnonymousCaller();

      const result = await anonCaller.decision.getInstance({
        instanceId: instance.instance.id,
      });

      expect(result.id).toBe(instance.instance.id);
      // ANONYMOUS role grants `decisions: READ | SUBMIT_PROPOSALS`.
      expect(result.access?.read).toBe(true);
      expect(result.access?.admin).toBe(false);
    });

    it('rejects a no-JWT caller on a non-public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      // Non-public by default — closed-network gate.

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      await expect(
        noJwtCaller.decision.getInstance({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    });

    it('rejects an anonymous JWT on a non-public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      // Non-public by default — closed-network gate.

      const anonCaller = await createAnonymousCaller();

      await expect(
        anonCaller.decision.getInstance({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    });
  });
});
