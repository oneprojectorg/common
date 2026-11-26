import { InngestTestEngine } from '@inngest/test';
import {
  confirmCategoryDevelopment,
  unconfirmCategoryDevelopment,
} from '@op/common';
import {
  TestDecisionsDataManager,
  createCategoryReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createTestTaxonomyTerm,
} from '@op/common/testing';
import { Events } from '@op/events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { sendCategoryAssignmentUnconfirmedNotification } from './sendCategoryAssignmentUnconfirmedNotification';

const createEvent = (data: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
}) => ({
  name: Events.categoryDevelopmentUnconfirmed.name,
  data: { ...data, phaseId: 'final' },
});

// Not concurrent: two parallel `createDevelopPhaseSetup` calls collide on a
// proposal slug.
describe('sendCategoryAssignmentUnconfirmedNotification', () => {
  it('reads the receipt for the address of the assigned person when the assignment is unconfirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const member = await createDevelopProposalsMember({ testData, setup });
    await createCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      reviewerProfileId: member.profileId,
      phaseId: 'final',
    });
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: member.user,
    });
    await unconfirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: setup.user,
    });

    const { result } = await new InngestTestEngine({
      function: sendCategoryAssignmentUnconfirmedNotification,
    }).executeStep('get-receipt', {
      events: [
        createEvent({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: member.profileId,
        }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        isConfirmed: false,
        categoryName: term.label,
        emails: [member.email],
      },
    });
  });

  it('skips an assignment that is confirmed again, or that is gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const member = await createDevelopProposalsMember({ testData, setup });
    await createCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      reviewerProfileId: member.profileId,
      phaseId: 'final',
    });
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: member.user,
    });

    const [confirmedAgain, missing] = await Promise.all(
      [member.profileId, randomUUID()].map((reviewerProfileId) =>
        new InngestTestEngine({
          function: sendCategoryAssignmentUnconfirmedNotification,
        }).execute({
          events: [
            createEvent({
              processInstanceId: instanceId,
              taxonomyTermId: term.id,
              reviewerProfileId,
            }),
          ],
        }),
      ),
    );

    expect(confirmedAgain?.error).toBeUndefined();
    expect(confirmedAgain?.result).toEqual({
      skipped: 'assignment confirmed again',
    });
    expect(missing?.error).toBeUndefined();
    expect(missing?.result).toEqual({
      skipped: 'process instance, category or assignment not found',
    });

    // A retry replays the first read; the send step must read the state again.
    const staleRead = await new InngestTestEngine({
      function: sendCategoryAssignmentUnconfirmedNotification,
      steps: [
        {
          id: 'get-receipt',
          handler: () => ({
            ok: true,
            receipt: {
              isConfirmed: false,
              confirmedCount: 1,
              assignmentCount: 1,
              categoryName: term.label,
              processName: setup.instance.instance.name,
              decisionSlug: setup.instance.slug,
              emails: [member.email],
            },
          }),
        },
      ],
    }).execute({
      events: [
        createEvent({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: member.profileId,
        }),
      ],
    });

    expect(staleRead.error).toBeUndefined();
    expect(staleRead.result).toEqual({ skipped: 'assignment confirmed again' });
  });
});
