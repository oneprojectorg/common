import { listReviewersWithOpenAssignments } from '@op/common';
import {
  TestDecisionsDataManager,
  TestReviewsDataManager,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProposalReviewAssignmentStatus,
  profiles,
  proposalReviewAssignments,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// The reminder workflows call this read directly; these run it against a real
// database.

async function createReminderScenario(
  taskId: string,
  onTestFinished: ConstructorParameters<typeof TestReviewsDataManager>[1],
) {
  const testData = new TestReviewsDataManager(taskId, onTestFinished);
  const decisions = new TestDecisionsDataManager(taskId, onTestFinished);
  const context = await testData.createContext();

  const behind = await testData.createInstanceReviewerWithRole(context);
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    status: ProposalReviewAssignmentStatus.PENDING,
  });
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
  });
  // Neither counts: one is finished, one is removed.
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  const removed = await testData.createReviewAssignment({
    context,
    reviewer: behind,
    status: ProposalReviewAssignmentStatus.IN_PROGRESS,
  });
  await db
    .update(proposalReviewAssignments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(proposalReviewAssignments.id, removed.assignment.id));

  // Open only in another phase of the same instance.
  const otherPhase = await testData.createInstanceMember(context);
  await testData.createReviewAssignment({
    context,
    reviewer: otherPhase,
    phaseId: 'voting',
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  // Open, but no account behind the profile.
  const [withoutAddress] = await db
    .insert(profiles)
    .values({
      name: 'No Account',
      slug: `no-account-${randomUUID()}`,
      type: EntityType.INDIVIDUAL,
    })
    .returning({ id: profiles.id });
  if (!withoutAddress) {
    throw new Error('Expected a profile without an account');
  }
  decisions.trackProfileForCleanup(withoutAddress.id);
  await testData.createReviewAssignment({
    context,
    reviewer: { profileId: withoutAddress.id, authUserId: '', email: '' },
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  // Open only in another instance.
  const foreign = await testData.createReviewAssignment({
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  return {
    processInstanceId: context.instance.instance.id,
    behind,
    otherPhase,
    withoutAddressProfileId: withoutAddress.id,
    foreignProfileId: foreign.reviewer.profileId,
  };
}

describe.concurrent('listReviewersWithOpenAssignments', () => {
  it('counts open assignments per reviewer in one instance and phase, in profile id order', async ({
    task,
    onTestFinished,
  }) => {
    const { processInstanceId, behind, withoutAddressProfileId } =
      await createReminderScenario(task.id, onTestFinished);

    const reviewers = await listReviewersWithOpenAssignments({
      processInstanceId,
      phaseId: 'review',
    });

    expect(reviewers).toEqual(
      [
        { reviewerProfileId: behind.profileId, remainingCount: 2 },
        { reviewerProfileId: withoutAddressProfileId, remainingCount: 1 },
      ].sort((first, second) =>
        first.reviewerProfileId < second.reviewerProfileId ? -1 : 1,
      ),
    );
  });

  it('keeps only the given reviewers, and none for an empty list', async ({
    task,
    onTestFinished,
  }) => {
    const { processInstanceId, behind, otherPhase, foreignProfileId } =
      await createReminderScenario(task.id, onTestFinished);

    const chosen = await listReviewersWithOpenAssignments({
      processInstanceId,
      phaseId: 'review',
      reviewerProfileIds: [
        behind.profileId,
        otherPhase.profileId,
        foreignProfileId,
      ],
    });

    expect(chosen).toEqual([
      { reviewerProfileId: behind.profileId, remainingCount: 2 },
    ]);

    await expect(
      listReviewersWithOpenAssignments({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileIds: [],
      }),
    ).resolves.toEqual([]);
  });
});
