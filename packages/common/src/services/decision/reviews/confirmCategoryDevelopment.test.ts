import {
  TestDecisionsDataManager,
  createCategoryReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createTestTaxonomyTerm,
} from '@op/common/testing';
import { Events, event } from '@op/events';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../utils';
import { confirmCategoryDevelopment } from './confirmCategoryDevelopment';

// Each case reads the shared `event.send` spy, so the cases run in sequence.
describe.sequential('confirmCategoryDevelopment', () => {
  it('sends one event for the category of a reviewer who confirms it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const { id: termA } = await createTestTaxonomyTerm({ onTestFinished });
    const reviewer = await createDevelopProposalsMember({ testData, setup });
    await createCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: termA,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'final',
    });

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA,
      user: reviewer.user,
    });

    expect(sentCategoryEvents(instanceId)).toEqual([
      {
        name: 'decision/category-development-confirmed',
        data: {
          processInstanceId: instanceId,
          phaseId: 'final',
          taxonomyTermId: termA,
        },
      },
    ]);
  });

  it('sends one event, not one per row, when an admin confirms a whole category', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const { id: termA } = await createTestTaxonomyTerm({ onTestFinished });
    const reviewers = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    await Promise.all(
      reviewers.map((reviewer) =>
        createCategoryReviewer({
          processInstanceId: instanceId,
          taxonomyTermId: termA,
          reviewerProfileId: reviewer.profileId,
          phaseId: 'final',
        }),
      ),
    );

    const result = await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA,
      user: setup.user,
    });

    expect(result.reviewers).toHaveLength(2);
    expect(sentCategoryEvents(instanceId)).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ taxonomyTermId: termA }),
      }),
    ]);
  });

  it('sends one event per category when a reviewer confirms all own rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const [{ id: termA }, { id: termB }] = await Promise.all([
      createTestTaxonomyTerm({ onTestFinished }),
      createTestTaxonomyTerm({ onTestFinished }),
    ]);
    const reviewer = await createDevelopProposalsMember({ testData, setup });
    await Promise.all(
      [termA, termB].map((taxonomyTermId) =>
        createCategoryReviewer({
          processInstanceId: instanceId,
          taxonomyTermId,
          reviewerProfileId: reviewer.profileId,
          phaseId: 'final',
        }),
      ),
    );

    await confirmCategoryDevelopment({
      processInstanceId: instanceId,
      user: reviewer.user,
    });

    expect(
      sentCategoryEvents(instanceId)
        .map((payload) => payload.data.taxonomyTermId)
        .sort(),
    ).toEqual([termA, termB].sort());
  });

  it('sends no event when no row is confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const { id: termWithoutRows } = await createTestTaxonomyTerm({
      onTestFinished,
    });

    await expect(
      confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termWithoutRows,
        user: setup.user,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(sentCategoryEvents(instanceId)).toEqual([]);
  });
});

function sentCategoryEvents(processInstanceId: string) {
  return vi
    .mocked(event.send)
    .mock.calls.flatMap(([payload]) =>
      Array.isArray(payload) ? payload : [payload],
    )
    .flatMap((payload) =>
      payload.name === Events.categoryDevelopmentConfirmed.name &&
      payload.data.processInstanceId === processInstanceId
        ? [payload]
        : [],
    );
}
