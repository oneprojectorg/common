import { listProcessParticipants } from '@op/common';
import { hasEmail } from '@op/common/client';
import { and, db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  profileUsers,
  proposals,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';

/**
 * Reproduces a public submitter: someone who authored a proposal but never
 * appeared in the process Members panel. Production grants them submit rights
 * through a public participant role rather than a profileUsers row, which is
 * exactly why the members-only query missed them.
 */
async function detachFromMembersPanel({
  processProfileId,
  authUserId,
}: {
  processProfileId: string;
  authUserId: string;
}): Promise<void> {
  await db
    .delete(profileUsers)
    .where(
      and(
        eq(profileUsers.profileId, processProfileId),
        eq(profileUsers.authUserId, authUserId),
      ),
    );
}

/** Attaches an extra person to a proposal's profile, as an accepted invite does. */
async function addProposalCollaborator({
  proposalProfileId,
  authUserId,
  email,
}: {
  proposalProfileId: string;
  authUserId: string;
  email: string | null;
}): Promise<void> {
  await db.insert(profileUsers).values({
    profileId: proposalProfileId,
    authUserId,
    email,
  });
}

async function createInstance(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    processSchema: schemaWithoutPipeline,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });

  return {
    setup,
    instanceId: setup.instance.instance.id,
    processProfileId: setup.instance.profileId,
  };
}

describe.concurrent('listProcessParticipants', () => {
  it('unions Members-panel members with proposal submitters who are not members', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, processProfileId } =
      await createInstance(testData);

    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [processProfileId],
    });

    await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instanceId,
      proposalData: { title: `Public submission ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // Only after the proposal exists, so the submitter's remaining tie to the
    // process is the proposal itself.
    await detachFromMembersPanel({
      processProfileId,
      authUserId: submitter.authUserId,
    });

    const emails = (
      await listProcessParticipants({
        processInstanceId: instanceId,
      })
    ).map(({ email }) => email);

    expect(emails).toContain(setup.userEmail);
    expect(emails).toContain(submitter.email);
  });

  it('includes a collaborator invited onto a proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createInstance(testData);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Collaborative proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const collaborator = await testData.createMemberUser({
      organization: setup.organization,
    });

    await addProposalCollaborator({
      proposalProfileId: proposal.profileId,
      authUserId: collaborator.authUserId,
      email: collaborator.email,
    });

    const participants = await listProcessParticipants({
      processInstanceId: instanceId,
    });

    expect(participants.map(({ email }) => email)).toContain(
      collaborator.email,
    );
  });

  it('returns a member who also submitted exactly once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createInstance(testData);

    // Two proposals, so a UNION ALL would surface the author three times.
    for (const index of [1, 2]) {
      await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${index} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    const participants = await listProcessParticipants({
      processInstanceId: instanceId,
    });

    expect(
      participants.filter(({ email }) => email === setup.userEmail),
    ).toHaveLength(1);
  });

  it('excludes authors whose only proposal is a draft or is deleted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, processProfileId } =
      await createInstance(testData);

    const draftAuthor = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [processProfileId],
    });
    const deletedAuthor = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [processProfileId],
    });

    await testData.createProposal({
      userEmail: draftAuthor.email,
      processInstanceId: instanceId,
      proposalData: { title: `Draft proposal ${task.id}` },
      status: ProposalStatus.DRAFT,
    });

    const deletedProposal = await testData.createProposal({
      userEmail: deletedAuthor.email,
      processInstanceId: instanceId,
      proposalData: { title: `Deleted proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, deletedProposal.id));

    await detachFromMembersPanel({
      processProfileId,
      authUserId: draftAuthor.authUserId,
    });
    await detachFromMembersPanel({
      processProfileId,
      authUserId: deletedAuthor.authUserId,
    });

    const emails = (
      await listProcessParticipants({
        processInstanceId: instanceId,
      })
    ).map(({ email }) => email);

    expect(emails).not.toContain(draftAuthor.email);
    expect(emails).not.toContain(deletedAuthor.email);
  });

  it('includes the author of a hidden proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, processProfileId } =
      await createInstance(testData);

    const hiddenAuthor = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [processProfileId],
    });

    const hiddenProposal = await testData.createProposal({
      userEmail: hiddenAuthor.email,
      processInstanceId: instanceId,
      proposalData: { title: `Hidden proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, hiddenProposal.id));

    await detachFromMembersPanel({
      processProfileId,
      authUserId: hiddenAuthor.authUserId,
    });

    const emails = (
      await listProcessParticipants({
        processInstanceId: instanceId,
      })
    ).map(({ email }) => email);

    // Moderation hides the proposal from readers; it does not un-enroll its
    // author from the process.
    expect(emails).toContain(hiddenAuthor.email);
  });

  it('returns address-less participants, which the email sender then filters out', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createInstance(testData);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Anonymous collaboration ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // Anonymous accounts carry a profileUsers row with a NULL email. They stay
    // in the participant set — a future SMS channel can still reach them — so
    // the address filter belongs to the sender, not to this service.
    const anonymous = await testData.createMemberUser({
      organization: setup.organization,
    });
    await addProposalCollaborator({
      proposalProfileId: proposal.profileId,
      authUserId: anonymous.authUserId,
      email: null,
    });

    const participants = await listProcessParticipants({
      processInstanceId: instanceId,
    });

    expect(
      participants.find(
        ({ authUserId }) => authUserId === anonymous.authUserId,
      ),
    ).toEqual({ authUserId: anonymous.authUserId, email: null });

    // The exact filter sendPhaseTransitionNotification applies before batching.
    const recipients = participants.filter(hasEmail);

    expect(
      recipients.some(({ authUserId }) => authUserId === anonymous.authUserId),
    ).toBe(false);
    expect(recipients.every(({ email }) => email.length > 0)).toBe(true);
  });
});
