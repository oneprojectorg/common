import { InngestTestEngine } from '@inngest/test';
import {
  TestReviewsDataManager,
  updateInstancePhases,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

import { sendReviewPhaseEndingReminder } from './sendReviewPhaseEndingReminder';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('sendReviewPhaseEndingReminder', () => {
  it('requests a reminder for every reviewer when a review phase ends inside the window', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const processInstanceId = context.instance.instance.id;

    const instance = await db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { name: true },
    });
    if (!instance) {
      throw new Error('Expected the process instance');
    }

    const now = Date.now();
    const endDate = new Date(now + 2.5 * MS_PER_DAY).toISOString();
    const reminderWindowEnd = new Date(now + 3 * MS_PER_DAY).toISOString();

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED, currentStateId: 'review' })
      .where(eq(processInstances.id, processInstanceId));
    await updateInstancePhases({
      instanceId: processInstanceId,
      update: () => [
        {
          phaseId: 'review',
          name: 'Review',
          endDate,
          rules: { reviews: { submit: true } },
        },
      ],
    });

    const { error, result, ctx } = await new InngestTestEngine({
      function: sendReviewPhaseEndingReminder,
      // The emit is a real Inngest call otherwise, and CI has no event key.
      steps: [{ id: 'request-review-reminder', handler: () => ({ ids: [] }) }],
    }).execute({
      events: [
        {
          name: Events.reviewPhaseEndingSoon.name,
          data: { processInstanceId, phaseId: 'review', reminderWindowEnd },
        },
      ],
    });
    expect(error).toBeUndefined();

    const batchId = `${processInstanceId}-review-${reminderWindowEnd}`;
    expect(result).toEqual({ batchId });
    expect(ctx.step.sendEvent).toHaveBeenCalledTimes(1);
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(expect.any(String), {
      name: Events.reviewReminderRequested.name,
      data: {
        batchId,
        processInstanceId,
        phaseId: 'review',
        message: `Hi {{firstName}},\n\nThe Review phase of ${instance.name} is planned to end in 3 days. You still have {{proposalsLeft}} left to complete.`,
      },
    });
  });
});
