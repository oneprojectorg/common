import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { mockCollab } from '@op/collab/testing';
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

describe.concurrent('getReviewAssignment', () => {
  it('returns the reviewer assignment with rubric and saved draft', async ({
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

    await testData.setRubricTemplate(created.context, rubricTemplate);
    await testData.attachFileToProposal({
      proposalId: created.proposal.id,
      uploadedByProfileId: created.author.profileId,
      fileName: 'community-garden-budget.pdf',
    });
    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: {
        impact: 5,
        impact__rationale: 'Strong fit',
      },
      overallComment: 'Promising proposal',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: created.assignment.id,
    });

    // Assignment metadata
    expect(result.assignment.id).toBe(created.assignment.id);
    expect(result.assignment.status).toBe(
      ProposalReviewAssignmentStatus.PENDING,
    );

    // Proposal shape
    expect(result.assignment.proposal.id).toBe(created.proposal.id);
    expect(result.assignment.proposal.likesCount).toBe(0);
    expect(result.assignment.proposal.followersCount).toBe(0);
    expect(result.assignment.proposal.commentsCount).toBe(0);

    // Rubric
    expect(result.rubricTemplate).toMatchObject(rubricTemplate);

    // Saved draft review
    expect(result.review).toMatchObject({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: {
        impact: 5,
        impact__rationale: 'Strong fit',
      },
      overallComment: 'Promising proposal',
    });

    // Attachments
    expect(result.assignment.proposal.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proposalId: created.proposal.id,
          attachment: expect.objectContaining({
            fileName: 'community-garden-budget.pdf',
          }),
        }),
      ]),
    );
  });

  it('rejects access for a different reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const otherReviewer = await testData.createReviewer(created.context);

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.getReviewAssignment({
        assignmentId: created.assignment.id,
      }),
    ).rejects.toThrow();
  });
});
