import { listProposalRejectionRecipients } from '@op/common';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  authUsers,
  profileUsers,
  processInstances,
  profiles,
  proposals,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

/**
 * An admin and one author in a published instance, plus a proposal by the
 * author already in the given status.
 */
async function createRejectedProposal(
  testData: TestDecisionsDataManager,
  {
    status = ProposalStatus.REJECTED,
    authoredByAdmin = false,
  }: { status?: ProposalStatus; authoredByAdmin?: boolean } = {},
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });
  const ada = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [setup.instance.profileId],
  });
  const proposal = await testData.createProposal({
    userEmail: authoredByAdmin ? setup.userEmail : ada.email,
    processInstanceId: setup.instance.instance.id,
    proposalData: {
      title: 'Community Garden Revamp',
      description: 'Community Garden Revamp',
    },
    status,
  });

  await db
    .update(profiles)
    .set({ name: 'Columbus Parks Coalition' })
    .where(eq(profiles.id, setup.organization.profileId));

  await db
    .update(processInstances)
    .set({
      currentStateId: 'review',
      instanceData: {
        phases: [{ phaseId: 'review', name: 'Review & Shortlist' }],
      },
      stewardProfileId: setup.organization.profileId,
    })
    .where(eq(processInstances.id, setup.instance.instance.id));

  const run = () =>
    listProposalRejectionRecipients({
      proposalId: proposal.id,
      actorAuthUserId: setup.user.id,
    });

  return { setup, ada, proposal, run };
}

describe.concurrent('listProposalRejectionRecipients', () => {
  it('addresses the author at their sign-in address, not the profileUsers snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, ada, proposal, run } =
      await createRejectedProposal(testData);
    // Nothing syncs this snapshot after an email change, so a recipient list
    // that reads it delivers to the wrong inbox.
    await db
      .update(profileUsers)
      .set({ email: `stale-${ada.email}` })
      .where(
        and(
          eq(profileUsers.profileId, proposal.profileId),
          eq(profileUsers.authUserId, ada.authUserId),
        ),
      );

    await expect(run()).resolves.toEqual({
      ok: true,
      notification: {
        proposalName: 'Community Garden Revamp',
        proposalProfileId: proposal.profileId,
        phaseName: 'Review & Shortlist',
        stewardName: 'Columbus Parks Coalition',
        processProfileSlug: setup.instance.slug,
        recipients: [{ email: ada.email }],
      },
    });
  });

  it.for([
    { currentStateId: null },
    { currentStateId: 'gone' },
    { instanceData: { phases: [{ phaseId: 'review' }] } },
  ])(
    'omits an unavailable phase name (%j)',
    async (overrides, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, run } = await createRejectedProposal(testData);
      await db
        .update(processInstances)
        .set(overrides)
        .where(eq(processInstances.id, setup.instance.instance.id));

      const result = await run();

      expect(result.ok).toBe(true);
      expect(result.ok && result.notification.phaseName).toBeUndefined();
    },
  );

  it('omits the steward name when the process has none', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, run } = await createRejectedProposal(testData);
    await db
      .update(processInstances)
      .set({ stewardProfileId: null })
      .where(eq(processInstances.id, setup.instance.instance.id));

    const result = await run();

    expect(result.ok).toBe(true);
    expect(result.ok && result.notification.stewardName).toBeUndefined();
  });

  // The success toast puts Undo one tap away, inside the debounce window.
  it('sends nothing once the rejection has been undone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { run } = await createRejectedProposal(testData, {
      status: ProposalStatus.SUBMITTED,
    });

    await expect(run()).resolves.toEqual({ ok: false, reason: 'notRejected' });
  });

  it('sends nothing when the proposal is gone', async () => {
    await expect(
      listProposalRejectionRecipients({
        proposalId: '11111111-1111-4111-8111-111111111111',
        actorAuthUserId: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toEqual({ ok: false, reason: 'proposalUnavailable' });
  });

  for (const [label, column] of [
    ['the proposal was deleted', 'deletedAt'],
    ['the proposal was moderation-detached', 'moderationDetachedAt'],
  ] as const) {
    it(`sends nothing when ${label}`, async ({ task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { proposal, run } = await createRejectedProposal(testData);
      await db
        .update(proposals)
        .set({ [column]: new Date().toISOString() })
        .where(eq(proposals.id, proposal.id));

      await expect(run()).resolves.toEqual({
        ok: false,
        reason: 'proposalUnavailable',
      });
    });
  }

  // An admin rejecting their own proposal should not be emailed about it.
  it('drops the actor, and sends nothing when they were the only author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { run } = await createRejectedProposal(testData, {
      authoredByAdmin: true,
    });

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  // Anonymous accounts carry no address in auth.users, whatever the snapshot
  // says they signed up with.
  it('skips co-authors who have no account address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, ada, proposal, run } =
      await createRejectedProposal(testData);
    const anonymous = await testData.createMemberUser({
      organization: setup.organization,
    });
    await db
      .update(authUsers)
      .set({ email: null, isAnonymous: true })
      .where(eq(authUsers.id, anonymous.authUserId));
    await db.insert(profileUsers).values({
      profileId: proposal.profileId,
      authUserId: anonymous.authUserId,
      email: anonymous.email,
    });

    const result = await run();

    expect(result.ok && result.notification.recipients).toEqual([
      { email: ada.email },
    ]);
  });
});
