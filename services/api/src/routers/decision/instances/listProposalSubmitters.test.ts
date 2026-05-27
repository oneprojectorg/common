import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  profileUsers,
  users,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
import {
  createAuthenticatedCaller,
  createIsolatedTestClient,
  createTestContextWithSession,
  createTestUser,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAnonymousCaller() {
  const client = createIsolatedTestClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Failed to sign in anonymously: ${error?.message}`);
  }
  return createCaller(await createTestContextWithSession(data.session));
}

describe.concurrent('listProposalSubmitters', () => {
  it('deduplicates submitters across multiple proposals by the same author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Same user submits two proposals → should appear once in the face pile.
    for (let i = 1; i <= 2; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    expect(result.submitters).toHaveLength(1);
  });

  it('excludes submitters whose only proposal is a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Draft is never submitted — submitter must not appear.
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Draft ${task.id}` },
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    expect(result.submitters).toHaveLength(0);
  });

  it('includes invited collaborators on the same proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Owner creates a proposal — they appear in the face pile by default.
    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Collab proposal ${task.id}` },
    });

    // Add a second user as a collaborator on the proposal's profile —
    // mirrors what acceptProposalInvite does when an invitee joins.
    const collaboratorEmail = `${task.id}-collab-${randomUUID()}@oneproject.org`;
    const collabAuth = await createTestUser(collaboratorEmail).then(
      (res) => res.user,
    );
    if (!collabAuth) {
      throw new Error('Failed to create collaborator auth user');
    }
    testData.trackAuthUserForCleanup(collabAuth.id);

    const [collabUserRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, collabAuth.id));
    if (collabUserRecord?.profileId) {
      testData.trackProfileForCleanup(collabUserRecord.profileId);
    }

    await db.insert(profileUsers).values({
      profileId: proposal.profileId,
      authUserId: collabAuth.id,
      email: collaboratorEmail,
    });

    await caller.decision.submitProposal({ proposalId: proposal.id });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    expect(result.submitters).toHaveLength(2);
  });

  // Public-mode gating: same shape as getInstance / getDecisionBySlug / listProposals.
  describe('public-mode gating', () => {
    it('allows a no-JWT caller to list submitters on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) throw new Error('No instance created');
      await testData.setInstancePublic(instance.instance.id);

      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Submitter facepile entry' },
      });
      const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
      await ownerCaller.decision.submitProposal({ proposalId: proposal.id });

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      const result = await noJwtCaller.decision.listProposalSubmitters({
        processInstanceId: instance.instance.id,
      });

      expect(result.submitters.length).toBeGreaterThanOrEqual(1);
    });

    it('allows an anonymous JWT to list submitters on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) throw new Error('No instance created');
      await testData.setInstancePublic(instance.instance.id);

      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Submitter facepile entry' },
      });
      const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
      await ownerCaller.decision.submitProposal({ proposalId: proposal.id });

      const anonCaller = await createAnonymousCaller();

      const result = await anonCaller.decision.listProposalSubmitters({
        processInstanceId: instance.instance.id,
      });

      expect(result.submitters.length).toBeGreaterThanOrEqual(1);
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
      if (!instance) throw new Error('No instance created');

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      await expect(
        noJwtCaller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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
      if (!instance) throw new Error('No instance created');

      const anonCaller = await createAnonymousCaller();

      await expect(
        anonCaller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    });
  });
});
