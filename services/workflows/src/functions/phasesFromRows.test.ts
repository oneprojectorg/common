import { InngestTestEngine } from '@inngest/test';
import type { DecisionSchemaDefinition } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  decisionsVoteSubmissions,
  processInstances,
  processPhases,
  profiles,
  users,
} from '@op/db/schema';
import { Events } from '@op/events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendReviewPhaseEndingReminders } from './modules/decisions/sendReviewPhaseEndingReminders';
import { sendPhaseTransitionNotification } from './notifications/sendPhaseTransitionNotification';
import { sendVoteSubmittedNotification } from './notifications/sendVoteSubmittedNotification';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const reviewSchema = {
  id: 'rows-workflow-review',
  version: '1.0.0',
  name: 'Rows Workflow Review Schema',
  phases: [
    {
      id: 'review',
      name: 'Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'results',
      name: 'Results',
      rules: { advancement: { method: 'manual' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

const forceFlag = (on: boolean) =>
  vi.stubEnv('NEXT_PUBLIC_E2E', on ? 'true' : '');

/** Renames every row and empties the blob phases: only the rows can answer. */
const leaveOnlyRows = async (
  instanceId: string,
  rowData: Record<string, unknown> = {},
) => {
  await db
    .update(processPhases)
    .set({
      data: sql`${processPhases.data} || ${JSON.stringify(rowData)}::jsonb`,
    })
    .where(eq(processPhases.processInstanceId, instanceId));
  await db
    .update(profiles)
    .set({ name: sql`'Row ' || (${processPhases.data} ->> 'phaseId')` })
    .from(processPhases)
    .where(
      sql`${profiles.id} = ${processPhases.profileId} AND ${processPhases.processInstanceId} = ${instanceId}`,
    );
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));
};

const createPublishedInstance = async (
  testData: TestDecisionsDataManager,
  processSchema?: typeof reviewSchema,
) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
    processSchema,
  });

  return { setup, instanceId: setup.instance.instance.id };
};

// Not concurrent: the flag is forced through the environment.
describe.each([
  { flag: 'on', on: true },
  { flag: 'off', on: false },
])('with process_phases_from_rows $flag and the blob emptied', ({ on }) => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the phases in the phase transition email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await createPublishedInstance(testData);
    await leaveOnlyRows(instanceId);
    forceFlag(on);

    const { result } = await new InngestTestEngine({
      function: sendPhaseTransitionNotification,
    }).executeStep('get-process-data', {
      events: [
        {
          name: Events.phaseTransitioned.name,
          data: {
            processInstanceId: instanceId,
            fromPhaseId: 'initial',
            toPhaseId: 'final',
          },
        },
      ],
    });

    expect(result).toMatchObject({
      phases: on ? [{ name: 'Row initial' }, { name: 'Row final' }] : [],
    });
  });

  it('lists the next phases in the vote email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createPublishedInstance(testData);
    const [voter] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, setup.user.id));
    if (!voter?.profileId) {
      throw new Error('Expected the voter to have a profile');
    }
    const [vote] = await db
      .insert(decisionsVoteSubmissions)
      .values({
        processInstanceId: instanceId,
        submittedByProfileId: voter.profileId,
        voteData: {
          schemaVersion: '1.0.0',
          schemaType: 'test',
          submissionMetadata: { timestamp: new Date().toISOString() },
          validationSignature: 'test',
        },
      })
      .returning({ id: decisionsVoteSubmissions.id });
    if (!vote) {
      throw new Error('Failed to insert the vote');
    }
    await leaveOnlyRows(instanceId);
    forceFlag(on);

    const { result } = await new InngestTestEngine({
      function: sendVoteSubmittedNotification,
    }).executeStep('get-vote-data', {
      events: [
        {
          name: Events.voteSubmitted.name,
          data: { voteSubmissionId: vote.id, processInstanceId: instanceId },
        },
      ],
    });

    expect(result).toMatchObject({
      phases: on ? [{ name: 'Row initial' }, { name: 'Row final' }] : [],
    });
  });

  it('queues the review reminder from the row end date', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await createPublishedInstance(
      testData,
      reviewSchema,
    );
    const midnightUtc = new Date().setUTCHours(0, 0, 0, 0);
    await db
      .update(processInstances)
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instanceId));
    await leaveOnlyRows(instanceId, {
      endDate: new Date(midnightUtc + 2.5 * MS_PER_DAY).toISOString(),
    });
    forceFlag(on);

    const { result } = await new InngestTestEngine({
      function: sendReviewPhaseEndingReminders,
    }).executeStep('find-ending-review-phases', {
      events: [{ name: 'inngest/scheduled.timer', data: {} }],
    });

    const reminders = Array.isArray(result) ? result : [];
    expect(
      reminders.filter(
        (reminder: { processInstanceId?: string }) =>
          reminder.processInstanceId === instanceId,
      ),
    ).toEqual(
      on ? [expect.objectContaining({ processInstanceId: instanceId })] : [],
    );
  });
});
