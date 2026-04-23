import { db, eq } from '@op/db/client';
import { ProposalStatus, profileUsers, users } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createInstanceWithSchema,
  executeTestTransition,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';
import { createTestUser } from '../../../test/supabase-utils';

describe.concurrent('listProposalSubmitters', () => {
  it('deduplicates submitters across multiple proposals by the same author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    // Same user submits two proposals → should appear once in the face pile.
    for (let i = 1; i <= 2; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await executeTestTransition({
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
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    // Draft is never submitted — submitter must not appear.
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Draft ${task.id}` },
    });

    await executeTestTransition({
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
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

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

    await executeTestTransition({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposalSubmitters({
      processInstanceId: instanceId,
    });

    expect(result.submitters).toHaveLength(2);
  });
});
