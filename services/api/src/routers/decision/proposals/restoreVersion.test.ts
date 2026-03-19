import { mockCollab } from '@op/collab/testing';
import { profiles, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

describe.concurrent('restoreProposalVersion', () => {
  it('should restore a proposal to a previous version', async ({
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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Current proposal' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    // Seed version history and fragment text that would be read back after revert
    mockCollab.setVersions(collaborationDocId, [
      {
        version: 1,
        createdAt: '2026-01-01T10:00:00.000Z',
        name: 'Version 1',
      },
      {
        version: 2,
        createdAt: '2026-01-02T10:00:00.000Z',
        name: 'Version 2',
      },
    ]);

    // After TipTap reverts the doc, our service reads back the fragments as text.
    // Seed the text responses that would come from the reverted document.
    mockCollab.setDocFragments(collaborationDocId, {
      default: 'Restored description text',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.restoreProposalVersion({
      proposalId: proposal.id,
      versionId: 1,
    });

    expect(result.id).toBe(proposal.id);

    // Verify the TipTap revert was called
    const revertCalls = mockCollab.getRevertCalls();
    expect(revertCalls).toContainEqual(
      expect.objectContaining({
        docName: collaborationDocId,
        versionId: 1,
      }),
    );

    // Verify DB was updated with lastEditedByProfileId
    const [dbProposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposal.id));

    expect(dbProposal?.lastEditedByProfileId).toBeTruthy();
  });

  it('should sync title back to profiles table on restore', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        'x-field-order': ['title', 'description'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          description: {
            type: 'string',
            title: 'Description',
            'x-format': 'long-text',
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Original Title' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    mockCollab.setVersions(collaborationDocId, [
      {
        version: 1,
        createdAt: '2026-01-01T10:00:00.000Z',
        name: 'Version 1',
      },
    ]);

    // Simulate that the reverted document has a different title
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Restored Title',
      description: 'Restored description',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.decision.restoreProposalVersion({
      proposalId: proposal.id,
      versionId: 1,
    });

    // Verify the profile name was synced
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, proposal.profileId));

    expect(profile?.name).toBe('Restored Title');
  });

  it('should throw NOT_FOUND for a non-existent proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.restoreProposalVersion({
        proposalId: '00000000-0000-0000-0000-000000000000',
        versionId: 1,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should throw NOT_FOUND when version does not exist', async ({
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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test proposal' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    // Seed only version 1 — requesting version 99 should fail
    mockCollab.setVersions(collaborationDocId, [
      {
        version: 1,
        createdAt: '2026-01-01T10:00:00.000Z',
        name: 'Version 1',
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.restoreProposalVersion({
        proposalId: proposal.id,
        versionId: 99,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should reject restore for users without edit access', async ({
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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test proposal' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    mockCollab.setVersions(collaborationDocId, [
      {
        version: 1,
        createdAt: '2026-01-01T10:00:00.000Z',
        name: 'Version 1',
      },
    ]);

    // Create a member user with NO profile access to the instance
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const caller = await createAuthenticatedCaller(memberUser.email);

    await expect(
      caller.decision.restoreProposalVersion({
        proposalId: proposal.id,
        versionId: 1,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });

  it('should reject restore for legacy proposals without collaboration doc', async ({
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

    // Create a legacy proposal (description triggers removal of collaborationDocId)
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Legacy proposal',
        description: 'Some HTML content',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.restoreProposalVersion({
        proposalId: proposal.id,
        versionId: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
