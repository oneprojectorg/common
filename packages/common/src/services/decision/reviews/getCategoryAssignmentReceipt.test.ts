import {
  TestDecisionsDataManager,
  createCategoryReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createTestTaxonomyTerm,
} from '@op/common/testing';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../utils';
import { confirmCategoryDevelopment } from './confirmCategoryDevelopment';
import { getCategoryAssignmentReceipt } from './getCategoryAssignmentReceipt';

// Not concurrent: two parallel `createDevelopPhaseSetup` calls collide on a
// proposal slug.
describe('getCategoryAssignmentReceipt', () => {
  it('counts the confirmed assignments of the category for the phase and ignores rows with no phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [firstMember, secondMember, reviewOnlyMember] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await Promise.all([
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: firstMember.profileId,
        phaseId: 'final',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: secondMember.profileId,
        phaseId: 'final',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: reviewOnlyMember.profileId,
        phaseId: null,
      }),
    ]);
    const readReceipt = (reviewerProfileId: string) =>
      getCategoryAssignmentReceipt({
        processInstanceId: instanceId,
        phaseId: 'final',
        taxonomyTermId: term.id,
        reviewerProfileId,
      });

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: firstMember.user,
    });
    const [firstAfterOne, secondAfterOne] = await Promise.all([
      readReceipt(firstMember.profileId),
      readReceipt(secondMember.profileId),
    ]);

    expect(firstAfterOne).toEqual({
      isConfirmed: true,
      confirmedCount: 1,
      assignmentCount: 2,
      categoryName: term.label,
      processName: setup.instance.instance.name,
      decisionSlug: setup.instance.slug,
      emails: [firstMember.email],
    });
    expect(secondAfterOne).toMatchObject({
      isConfirmed: false,
      confirmedCount: 1,
      assignmentCount: 2,
      emails: [secondMember.email],
    });

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: term.id,
      user: secondMember.user,
    });

    await expect(readReceipt(secondMember.profileId)).resolves.toMatchObject({
      isConfirmed: true,
      confirmedCount: 2,
      assignmentCount: 2,
    });
  });

  it('throws NotFoundError for a missing instance, category or assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const term = await createTestTaxonomyTerm({ onTestFinished });
    const [member, reviewOnlyMember] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await Promise.all([
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: member.profileId,
        phaseId: 'final',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: term.id,
        reviewerProfileId: reviewOnlyMember.profileId,
        phaseId: null,
      }),
    ]);
    const assignment = {
      processInstanceId: instanceId,
      phaseId: 'final',
      taxonomyTermId: term.id,
      reviewerProfileId: member.profileId,
    };

    await Promise.all([
      expect(
        getCategoryAssignmentReceipt({
          ...assignment,
          processInstanceId: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(NotFoundError),
      expect(
        getCategoryAssignmentReceipt({
          ...assignment,
          taxonomyTermId: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(NotFoundError),
      expect(
        getCategoryAssignmentReceipt({
          ...assignment,
          reviewerProfileId: reviewOnlyMember.profileId,
        }),
      ).rejects.toBeInstanceOf(NotFoundError),
    ]);
  });
});
