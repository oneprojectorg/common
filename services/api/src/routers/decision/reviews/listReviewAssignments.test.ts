import { mockCollab } from '@op/collab/testing';
import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { createProposalReview } from '@op/test';
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
  'x-field-order': ['impact', 'impact__rationale'],
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
    impact__rationale: {
      type: 'string',
      title: 'Why',
      'x-format': 'long-text',
    },
  },
  required: ['impact', 'impact__rationale'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

function seedMockCollab(collaborationDocId: string) {
  mockCollab.setDocResponse(collaborationDocId, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Community garden proposal content' }],
      },
    ],
  });
}

describe.concurrent('listReviewAssignments', () => {
  it('returns all assignments for the reviewer in the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: 'Community Garden Expansion',
    });

    const second = await testData.createReviewAssignment({
      context: first.context,
      reviewer: first.reviewer,
      title: 'Youth Arts Festival',
    });

    const { collaborationDocId: docId1 } = first.proposal.proposalData as {
      collaborationDocId: string;
    };
    const { collaborationDocId: docId2 } = second.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(docId1);
    seedMockCollab(docId2);

    const reviewerCaller = await createAuthenticatedCaller(
      first.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: first.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.map((a) => a.assignment.id)).toEqual(
      expect.arrayContaining([first.assignment.id, second.assignment.id]),
    );
  });

  it('includes rubric template and review data per assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Community Garden Expansion',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    await Promise.all([
      testData.setRubricTemplate(created.context, rubricTemplate),
      createProposalReview({
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          impact: 5,
          impact__rationale: 'Strong fit',
        },
        overallComment: 'Promising proposal',
      }),
    ]);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.PENDING,
        proposal: {
          id: created.proposal.id,
        },
      },
      rubricTemplate,
      review: {
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          impact: 5,
          impact__rationale: 'Strong fit',
        },
        overallComment: 'Promising proposal',
      },
    });
  });

  it('returns empty list when reviewer has no assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const otherReviewer = await testData.createReviewer(created.context);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);
    const result = await otherCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(0);
  });

  it('rejects access for users without review permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();

    // Author doesn't have review access
    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.listReviewAssignments({
        processInstanceId: created.context.instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
