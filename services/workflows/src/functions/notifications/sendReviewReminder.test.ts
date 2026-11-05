import { InngestTestEngine } from '@inngest/test';
import {
  TestDecisionsDataManager,
  TestReviewsDataManager,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  processInstances,
  profiles,
} from '@op/db/schema';
import { Events } from '@op/events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { recordedEmails } from '../../../testing/mocks/emails';
import { sendReviewReminder } from './sendReviewReminder';

const message = 'Hi {{firstName}},\n\nYou have {{proposalsLeft}} left.';

const executeReminder = (data: {
  batchId: string;
  processInstanceId: string;
  phaseId: string;
  reviewerProfileIds?: string[];
  message: string;
}) =>
  new InngestTestEngine({ function: sendReviewReminder }).execute({
    events: [{ name: Events.reviewReminderRequested.name, data }],
  });

describe('sendReviewReminder', () => {
  it('emails only the chosen reviewers with open assignments in the instance and phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const processInstanceId = context.instance.instance.id;

    // The steward, not the creator, names the sender.
    const [steward] = await db
      .insert(profiles)
      .values({
        name: 'Steward Org',
        slug: `steward-org-${randomUUID()}`,
        type: EntityType.ORG,
      })
      .returning({ id: profiles.id, name: profiles.name });
    if (!steward) {
      throw new Error('Expected a steward profile');
    }
    decisions.trackProfileForCleanup(steward.id);

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED, stewardProfileId: steward.id })
      .where(eq(processInstances.id, processInstanceId));

    // A name that holds a token must reach the email as typed.
    const behind = await testData.createInstanceReviewerWithRole(context);
    await db
      .update(profiles)
      .set({ name: '{{proposalsLeft}} Lovelace' })
      .where(eq(profiles.id, behind.profileId));
    await testData.createReviewAssignment({
      context,
      reviewer: behind,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    await testData.createReviewAssignment({
      context,
      reviewer: behind,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const finished = await testData.createInstanceMember(context);
    await testData.createReviewAssignment({
      context,
      reviewer: finished,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    // An open assignment, but no account behind the profile: no address.
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

    // An open assignment in this instance, but not chosen.
    await testData.createReviewAssignment({
      context,
      reviewer: context.defaultReviewer,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    // An open assignment in another instance only.
    const foreign = await testData.createReviewAssignment({
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const instance = await db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { name: true },
    });
    if (!instance) {
      throw new Error('Expected the process instance');
    }

    const batchId = randomUUID();
    const { error } = await executeReminder({
      batchId,
      processInstanceId,
      phaseId: 'review',
      reviewerProfileIds: [
        behind.profileId,
        finished.profileId,
        withoutAddress.id,
        foreign.reviewer.profileId,
      ],
      message,
    });
    expect(error).toBeUndefined();

    const candidates = new Set([
      behind.email,
      finished.email,
      context.defaultReviewer.email,
      foreign.reviewer.email,
    ]);
    const sent = recordedEmails.filter(({ to }) => candidates.has(to));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: behind.email,
      from: `${steward.name} via Common`,
      subject: `Reminder: your reviews in "${instance.name}"`,
    });
    expect(sent[0]?.idempotencyKeyPrefix).toMatch(/^review-reminder\//);
    expect(sent[0]?.text).toContain('Hi {{proposalsLeft}},');
    expect(sent[0]?.text).toContain('You have 2 proposals left.');
  });

  it('emails every reviewer with open assignments when no reviewers are chosen', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const processInstanceId = context.instance.instance.id;

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED })
      .where(eq(processInstances.id, processInstanceId));

    const pending = await testData.createInstanceReviewerWithRole(context);
    await testData.createReviewAssignment({
      context,
      reviewer: pending,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const reReview = await testData.createInstanceMember(context);
    await testData.createReviewAssignment({
      context,
      reviewer: reReview,
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    const finished = await testData.createInstanceMember(context);
    await testData.createReviewAssignment({
      context,
      reviewer: finished,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const { error } = await executeReminder({
      batchId: randomUUID(),
      processInstanceId,
      phaseId: 'review',
      message,
    });
    expect(error).toBeUndefined();

    const candidates = new Set([pending.email, reReview.email, finished.email]);
    const sent = recordedEmails
      .filter(({ to }) => candidates.has(to))
      .map(({ to }) => to);

    expect(sent.sort()).toEqual([pending.email, reReview.email].sort());
  });

  it('sends from Common when the instance has no steward', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const processInstanceId = context.instance.instance.id;

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED, stewardProfileId: null })
      .where(eq(processInstances.id, processInstanceId));

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    await testData.createReviewAssignment({
      context,
      reviewer,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const { error } = await executeReminder({
      batchId: randomUUID(),
      processInstanceId,
      phaseId: 'review',
      reviewerProfileIds: [reviewer.profileId],
      message,
    });
    expect(error).toBeUndefined();

    const sent = recordedEmails.filter(({ to }) => to === reviewer.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.from).toBeUndefined();
  });

  it('sends nothing when the instance is not published', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const processInstanceId = context.instance.instance.id;

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.DRAFT })
      .where(eq(processInstances.id, processInstanceId));

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    await testData.createReviewAssignment({
      context,
      reviewer,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const { error } = await executeReminder({
      batchId: randomUUID(),
      processInstanceId,
      phaseId: 'review',
      reviewerProfileIds: [reviewer.profileId],
      message,
    });
    expect(error).toBeUndefined();

    expect(recordedEmails.filter(({ to }) => to === reviewer.email)).toEqual(
      [],
    );
  });
});
