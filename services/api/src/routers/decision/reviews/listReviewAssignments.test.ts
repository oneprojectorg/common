import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('listReviewAssignments', () => {
  it('lists all assignments for the current reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const firstAssignment = await testData.createReviewAssignment({
      title: 'Community Garden Expansion',
    });

    const secondAssignment = await testData.createReviewAssignment({
      context: firstAssignment.context,
      title: 'Library Roof Repair',
    });

    const thirdAssignment = await testData.createReviewAssignment({
      context: firstAssignment.context,
      title: 'Neighborhood Tool Library',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      firstAssignment.reviewer.email,
    );

    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: firstAssignment.instance.instance.id,
    });

    expect(result.total).toBe(3);
    expect(result.completed).toBe(0);
    expect(result.assignments).toHaveLength(3);
    expect(result.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstAssignment.assignment.id,
          status: ProposalReviewAssignmentStatus.PENDING,
          proposal: expect.objectContaining({
            id: firstAssignment.proposal.id,
            profile: expect.objectContaining({
              name: 'Community Garden Expansion',
            }),
          }),
        }),
        expect.objectContaining({
          id: secondAssignment.assignment.id,
          status: ProposalReviewAssignmentStatus.PENDING,
          proposal: expect.objectContaining({
            id: secondAssignment.proposal.id,
            profile: expect.objectContaining({
              name: 'Library Roof Repair',
            }),
          }),
        }),
        expect.objectContaining({
          id: thirdAssignment.assignment.id,
          status: ProposalReviewAssignmentStatus.PENDING,
          proposal: expect.objectContaining({
            id: thirdAssignment.proposal.id,
            profile: expect.objectContaining({
              name: 'Neighborhood Tool Library',
            }),
          }),
        }),
      ]),
    );
  });

  it('lists only assignments for the current reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const firstAssignment = await testData.createReviewAssignment({
      title: 'Community Garden Expansion',
    });

    const otherReviewer = await testData.createReviewer(
      firstAssignment.context,
    );

    const secondAssignment = await testData.createReviewAssignment({
      context: firstAssignment.context,
      title: 'Library Roof Repair',
    });

    await testData.createReviewAssignment({
      context: firstAssignment.context,
      reviewer: otherReviewer,
      title: 'Public Wi-Fi Expansion',
    });

    await testData.createReviewAssignment({
      context: firstAssignment.context,
      reviewer: otherReviewer,
      title: 'Community Fridge Network',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      firstAssignment.reviewer.email,
    );

    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: firstAssignment.instance.instance.id,
    });

    expect(result.total).toBe(2);
    expect(result.completed).toBe(0);
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstAssignment.assignment.id,
          proposal: expect.objectContaining({
            profile: expect.objectContaining({
              name: 'Community Garden Expansion',
            }),
          }),
        }),
        expect.objectContaining({
          id: secondAssignment.assignment.id,
          proposal: expect.objectContaining({
            profile: expect.objectContaining({
              name: 'Library Roof Repair',
            }),
          }),
        }),
      ]),
    );
  });
});
