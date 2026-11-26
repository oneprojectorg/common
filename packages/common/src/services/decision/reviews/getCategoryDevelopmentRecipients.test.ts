import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  addProposalToCategory,
  createCategoryReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createTestTaxonomyTerm,
  grantInstanceRole,
} from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { createDevelopedProposal } from '../createDevelopedProposal';
import { submitDevelopedProposal } from '../submitDevelopedProposal';
import { confirmCategoryDevelopment } from './confirmCategoryDevelopment';
import { getCategoryDevelopmentRecipients } from './getCategoryDevelopmentRecipients';

describe.concurrent('getCategoryDevelopmentRecipients', () => {
  it('reports the category complete only after every category reviewer of the phase confirms', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [firstReviewer, secondReviewer, reviewOnlyReviewer] =
      await Promise.all([
        createDevelopProposalsMember({ testData, setup }),
        createDevelopProposalsMember({ testData, setup }),
        createDevelopProposalsMember({ testData, setup }),
      ]);
    await Promise.all([
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: firstReviewer.profileId,
        phaseId: 'final',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: secondReviewer.profileId,
        phaseId: 'final',
      }),
      // Never confirmed, and not for the phase: it must not hold the category back.
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: reviewOnlyReviewer.profileId,
        phaseId: null,
      }),
    ]);

    const entry = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: firstReviewer.user,
    });
    testData.trackProfileForCleanup(entry.profileId);
    await submitDevelopedProposal({
      data: { proposalId: entry.id },
      user: firstReviewer.user,
    });
    await addProposalToCategory({
      proposalId: entry.id,
      taxonomyTermId: term.id,
    });

    const readRecipients = () =>
      getCategoryDevelopmentRecipients({
        processInstanceId: instanceId,
        phaseId: 'final',
        taxonomyTermId: term.id,
      });

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: firstReviewer.user,
    });
    const partial = await readRecipients();

    expect(partial.isComplete).toBe(false);
    expect([...partial.reviewerEmails].sort()).toEqual(
      [firstReviewer.email, secondReviewer.email].sort(),
    );

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: secondReviewer.user,
    });
    const complete = await readRecipients();

    expect(complete).toEqual({
      isComplete: true,
      categoryName: term.label,
      processName: setup.instance.instance.name,
      decisionSlug: setup.instance.slug,
      advancingCount: 1,
      adminEmails: [setup.userEmail],
      reviewerEmails: expect.arrayContaining([
        firstReviewer.email,
        secondReviewer.email,
      ]),
    });
    expect(complete.reviewerEmails).toHaveLength(2);
  });

  it('lists an admin who is also a category reviewer only as an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const [term, termWithoutRows] = await Promise.all([
      createTestTaxonomyTerm({ onTestFinished }),
      createTestTaxonomyTerm({ onTestFinished }),
    ]);
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

    const [recipients, recipientsWithoutRows] = await Promise.all(
      [term, termWithoutRows].map(({ id }) =>
        getCategoryDevelopmentRecipients({
          processInstanceId: instanceId,
          phaseId: 'final',
          taxonomyTermId: id,
        }),
      ),
    );

    expect([...(recipients?.adminEmails ?? [])].sort()).toEqual(
      [setup.userEmail, adminReviewer.email].sort(),
    );
    expect(recipients?.reviewerEmails).toEqual([reviewer.email]);
    expect(recipientsWithoutRows).toMatchObject({
      isComplete: false,
      reviewerEmails: [],
    });
  });
});
