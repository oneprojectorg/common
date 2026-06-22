import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  objectsInStorage,
  profileUsers,
  profiles,
  users,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
import {
  createAuthenticatedCaller,
  createIsolatedTestClient,
  createTestUser,
} from '../../../test/supabase-utils';

/** Gives a profile an avatar so it qualifies for the face pile. */
async function giveProfileAvatar(profileId: string): Promise<void> {
  const [storageObject] = await db
    .insert(objectsInStorage)
    .values({ bucketId: 'assets', name: `face-pile-test/${profileId}` })
    .returning();

  await db
    .update(profiles)
    .set({ avatarImageId: storageObject!.id })
    .where(eq(profiles.id, profileId));
}

/** Looks up the individual profile a submitter is displayed as. */
async function profileForAuthUser(
  authUserId: string,
): Promise<{ id: string; slug: string }> {
  const [row] = await db
    .select({ id: profiles.id, slug: profiles.slug })
    .from(users)
    .innerJoin(profiles, eq(profiles.id, users.profileId))
    .where(eq(users.authUserId, authUserId));

  if (!row) {
    throw new Error(`No individual profile for auth user ${authUserId}`);
  }

  return row;
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

    expect(result.total).toBe(1);
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

    expect(result.total).toBe(0);
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

    expect(result.total).toBe(2);
  });

  it('counts anonymous submitters in the total but keeps them out of the face pile', async ({
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
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // An anonymous account collaborates on the proposal. Give it an avatar so
    // the only reason it stays out of the pile is its anonymity.
    const anonClient = createIsolatedTestClient();
    const { data: anon, error } = await anonClient.auth.signInAnonymously();
    if (error || !anon.user) {
      throw new Error(`Failed to sign in anonymously: ${error?.message}`);
    }
    testData.trackAuthUserForCleanup(anon.user.id);
    const anonProfile = await profileForAuthUser(anon.user.id);
    testData.trackProfileForCleanup(anonProfile.id);
    await giveProfileAvatar(anonProfile.id);

    await db.insert(profileUsers).values({
      profileId: proposal.profileId,
      authUserId: anon.user.id,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    // Owner + anonymous collaborator both count toward the total.
    expect(result.total).toBe(2);
    // ...but the anonymous account is never a face, even with an avatar.
    expect(result.submitters.some((s) => s.slug === anonProfile.slug)).toBe(
      false,
    );
  });

  it('shows registered submitters with an avatar as faces and omits those without', async ({
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
    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Owner submits but has no avatar → counted, never a face.
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // A registered collaborator with an avatar → the one face shown.
    const collaboratorEmail = `${task.id}-collab-${randomUUID()}@oneproject.org`;
    const collabAuth = await createTestUser(collaboratorEmail).then(
      (res) => res.user,
    );
    if (!collabAuth) {
      throw new Error('Failed to create collaborator auth user');
    }
    testData.trackAuthUserForCleanup(collabAuth.id);
    const collabProfile = await profileForAuthUser(collabAuth.id);
    testData.trackProfileForCleanup(collabProfile.id);
    await giveProfileAvatar(collabProfile.id);

    await db.insert(profileUsers).values({
      profileId: proposal.profileId,
      authUserId: collabAuth.id,
      email: collaboratorEmail,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    expect(result.total).toBe(2);
    expect(result.submitters).toHaveLength(1);
    expect(result.submitters[0]?.slug).toBe(collabProfile.slug);
    expect(result.submitters[0]?.avatarImage).not.toBeNull();
  });
});

describeDecisionAccessTierGating('listProposalSubmitters', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
        }),
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.listProposalSubmitters({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),
});
