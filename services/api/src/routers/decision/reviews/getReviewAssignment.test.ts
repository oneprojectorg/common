import { mockCollab } from '@op/collab/testing';
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
  it('returns the assignment using the live proposal when no history snapshot exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Live Proposal Review',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: created.assignment.id,
    });

    expect(result).toMatchObject({
      assignment: {
        id: created.assignment.id,
        proposal: {
          id: created.proposal.id,
        },
      },
      review: null,
      revisionRequest: null,
    });
  });

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

    const [, , , reviewerCaller] = await Promise.all([
      testData.setRubricTemplate(created.context, rubricTemplate),
      testData.attachFileToProposal({
        proposalId: created.proposal.id,
        uploadedByProfileId: created.author.profileId,
        fileName: 'community-garden-budget.pdf',
      }),
      createProposalReview({
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          impact: 5,
          impact__rationale: 'Strong fit',
        },
        overallComment: 'Promising proposal',
      }),
      createAuthenticatedCaller(created.reviewer.email),
    ]);
    const result = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: created.assignment.id,
    });

    expect(result).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.PENDING,
        proposal: {
          id: created.proposal.id,
          likesCount: 0,
          followersCount: 0,
          commentsCount: 0,
          attachments: expect.arrayContaining([
            expect.objectContaining({
              proposalId: created.proposal.id,
              attachment: expect.objectContaining({
                fileName: 'community-garden-budget.pdf',
              }),
            }),
          ]),
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

  it('returns null review when reviewer has not started', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Fresh Assignment',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: created.assignment.id,
    });

    expect(result).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.PENDING,
        proposal: {
          id: created.proposal.id,
        },
      },
      review: null,
      revisionRequest: null,
    });
  });

  it('returns the revision request when one exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Proposal Needing Revision',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please add more budget detail.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: created.assignment.id,
    });

    expect(result).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      },
      review: null,
      revisionRequest: {
        id: revisionRequest.id,
        assignmentId: created.assignment.id,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment: 'Please add more budget detail.',
      },
    });
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
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
