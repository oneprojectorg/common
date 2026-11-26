import { InngestTestEngine } from '@inngest/test';
import { confirmCategoryDevelopment } from '@op/common';
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

import { sendCategoryAssignmentConfirmedNotification } from './sendCategoryAssignmentConfirmedNotification';

const createEvent = (data: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
}) => ({
  name: Events.categoryDevelopmentConfirmed.name,
  data: { ...data, phaseId: 'final' },
});

// Not concurrent: two parallel `createDevelopPhaseSetup` calls collide on a
// proposal slug.
describe('sendCategoryAssignmentConfirmedNotification', () => {
  it('reads the receipt for the address of the assigned person when the assignment is confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [member, otherMember] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await Promise.all(
      [member, otherMember].map(({ profileId }) =>
        createCategoryReviewer({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: profileId,
          phaseId: 'final',
        }),
      ),
    );
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: member.user,
    });

    const { result } = await new InngestTestEngine({
      function: sendCategoryAssignmentConfirmedNotification,
    }).executeStep('get-receipt', {
      events: [
        createEvent({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: member.profileId,
        }),
      ],
    });

    expect(result).toEqual({
      ok: true,
      receipt: {
        isConfirmed: true,
        confirmedCount: 1,
        assignmentCount: 2,
        categoryName: term.label,
        processName: setup.instance.instance.name,
        decisionSlug: setup.instance.slug,
        emails: [member.email],
      },
    });
  });

  it('skips an assignment that is not confirmed any more, or that is gone', async ({
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

    const [notConfirmed, missing] = await Promise.all(
      [member.profileId, randomUUID()].map((reviewerProfileId) =>
        new InngestTestEngine({
          function: sendCategoryAssignmentConfirmedNotification,
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

    expect(notConfirmed?.error).toBeUndefined();
    expect(notConfirmed?.result).toEqual({
      skipped: 'assignment no longer confirmed',
    });
    expect(missing?.error).toBeUndefined();
    expect(missing?.result).toEqual({
      skipped: 'process instance, category or assignment not found',
    });
  });
});
