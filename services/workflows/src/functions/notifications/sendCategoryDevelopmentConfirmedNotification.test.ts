import { InngestTestEngine } from '@inngest/test';
import { confirmCategoryDevelopment } from '@op/common';
import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createCategoryReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createTestTaxonomyTerm,
  grantInstanceRole,
} from '@op/common/testing';
import { Events } from '@op/events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { sendCategoryDevelopmentConfirmedNotification } from './sendCategoryDevelopmentConfirmedNotification';

const createEvent = ({
  processInstanceId,
  taxonomyTermId,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
}) => ({
  name: Events.categoryDevelopmentConfirmed.name,
  data: { processInstanceId, phaseId: 'final', taxonomyTermId },
});

describe('sendCategoryDevelopmentConfirmedNotification', () => {
  it('sends nothing while a category reviewer has not confirmed, or when the category is gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [confirmedReviewer, pendingReviewer] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await Promise.all(
      [confirmedReviewer, pendingReviewer].map((member) =>
        createCategoryReviewer({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: member.profileId,
          phaseId: 'final',
        }),
      ),
    );
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: confirmedReviewer.user,
    });

    const [partial, missingTerm] = await Promise.all(
      [term.id, randomUUID()].map((taxonomyTermId) =>
        new InngestTestEngine({
          function: sendCategoryDevelopmentConfirmedNotification,
        }).execute({
          events: [
            createEvent({ processInstanceId: instanceId, taxonomyTermId }),
          ],
        }),
      ),
    );

    expect(partial?.error).toBeUndefined();
    expect(partial?.result).toEqual({
      skipped: 'category not confirmed by every reviewer',
    });
    expect(missingTerm?.error).toBeUndefined();
    expect(missingTerm?.result).toEqual({
      skipped: 'process instance or category not found',
    });
  });

  it('lists the decisions admins as recipients once every reviewer confirms', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [adminReviewer, reviewer] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: adminReviewer.authUserId,
      email: adminReviewer.email,
      roleName: `Decisions admin ${adminReviewer.authUserId}`,
      decisionsPermission:
        TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.ADMIN,
    });
    await Promise.all(
      [adminReviewer, reviewer].map((member) =>
        createCategoryReviewer({
          processInstanceId: instanceId,
          taxonomyTermId: term.id,
          reviewerProfileId: member.profileId,
          phaseId: 'final',
        }),
      ),
    );
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: reviewer.user,
    });
    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      reviewerProfileId: adminReviewer.profileId,
      user: adminReviewer.user,
    });

    const { result } = await new InngestTestEngine({
      function: sendCategoryDevelopmentConfirmedNotification,
    }).executeStep('get-recipients', {
      events: [
        createEvent({ processInstanceId: instanceId, taxonomyTermId: term.id }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      recipients: {
        isComplete: true,
        categoryName: term.label,
        adminEmails: expect.arrayContaining([
          setup.userEmail,
          adminReviewer.email,
        ]),
      },
    });
    expect(result).not.toMatchObject({
      recipients: { adminEmails: expect.arrayContaining([reviewer.email]) },
    });
  });
});
