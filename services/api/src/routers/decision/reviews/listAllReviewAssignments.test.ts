import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { createProposalReview, createRevisionRequest } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact'],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 5, title: 'High' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('listAllReviewAssignments', () => {
  it('returns every assignment in the instance for an admin, including ones without reviews', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: 'First Proposal',
    });

    const otherReviewer = await testData.createReviewer(first.context);
    const second = await testData.createReviewAssignment({
      context: first.context,
      reviewer: otherReviewer,
      title: 'Second Proposal',
    });

    // Default context user is provisioned with admin access on the instance.
    const adminCaller = await createAuthenticatedCaller(
      first.context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listAllReviewAssignments({
      processInstanceId: first.context.instance.instance.id,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.assignment.id)).toEqual(
      expect.arrayContaining([first.assignment.id, second.assignment.id]),
    );

    for (const item of result.items) {
      expect(item.review).toBeNull();
      expect(item.assignment.reviewer).toMatchObject({
        id: expect.any(String),
      });
    }
  });

  it('omits documentContent, htmlContent, proposalTemplate, and attachments from proposal payloads', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Shape Check',
    });

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listAllReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.items).toHaveLength(1);
    const proposal = result.items[0]!.assignment.proposal;

    expect(proposal).not.toHaveProperty('documentContent');
    expect(proposal).not.toHaveProperty('htmlContent');
    expect(proposal).not.toHaveProperty('proposalTemplate');
    expect(proposal).not.toHaveProperty('attachments');
  });

  it('includes rubric template at the response root and review + revision data on items', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'With Rubric',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await Promise.all([
      testData.setRubricTemplate(created.context, rubricTemplate),
      createProposalReview({
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          answers: { impact: 5 },
          rationales: { impact: 'Strong fit' },
        },
        overallComment: 'Promising',
      }),
      createRevisionRequest({
        assignmentId: created.assignment.id,
        requestComment: 'Please expand the budget.',
      }),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listAllReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.rubricTemplate).toEqual(rubricTemplate);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      },
      review: {
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
      },
      revisionRequest: {
        assignmentId: created.assignment.id,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment: 'Please expand the budget.',
      },
    });
  });

  it('rejects reviewer-only callers without admin access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const reviewerOnly = await testData.createInstanceReviewerWithRole(
      created.context,
    );

    const reviewerCaller = await createAuthenticatedCaller(reviewerOnly.email);

    await expect(
      reviewerCaller.decision.listAllReviewAssignments({
        processInstanceId: created.context.instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('rejects non-participant callers (e.g. the proposal author)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.listAllReviewAssignments({
        processInstanceId: created.context.instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
