import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import {
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import {
  type ReviewAssignmentList,
  reviewAssignmentListSchema,
} from './schemas/reviews';

/** Returns all authorized review assignments for the current reviewer in a process instance. */
export async function listReviewAssignments({
  processInstanceId,
  status,
  dir = 'asc',
  user,
}: {
  processInstanceId: string;
  status?: string;
  dir?: 'asc' | 'desc';
  user: User;
}): Promise<ReviewAssignmentList> {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      reviewerProfileId: dbUser.profileId,
      ...(status && { status }),
    },
    with: reviewAssignmentWithConfig,
    orderBy: {
      assignedAt: dir,
    },
  });

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );
  const rubricTemplate = instance.instanceData.rubricTemplate ?? null;

  const docContentInputs: Array<{
    id: string;
    proposalData: unknown;
    proposalTemplate: typeof proposalTemplate;
    collaborationDocVersionId?: number;
  }> = [];

  for (const assignment of assignments) {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    docContentInputs.push({
      id: proposalSnapshot.id,
      proposalData: proposalSnapshot.proposalData,
      proposalTemplate,
      collaborationDocVersionId:
        proposalSnapshot.proposalData.collaborationDocVersionId,
    });
  }

  const documentContentMap =
    await getProposalDocumentsContent(docContentInputs);

  const assignmentList = assignments.map((assignment) => {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    const documentContent = documentContentMap.get(proposalSnapshot.id);

    let htmlContent: Record<string, string> | undefined;
    if (documentContent?.type === 'json') {
      htmlContent = generateProposalHtml(documentContent.fragments);
    } else if (documentContent?.type === 'html') {
      htmlContent = { default: documentContent.content };
    }

    return {
      assignment: {
        ...assignment,
        proposal: {
          ...proposalSnapshot,
          proposalTemplate,
          documentContent,
          htmlContent,
        },
      },
      rubricTemplate,
      review: assignment.reviews[0] ?? null,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
    };
  });

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
  });
}
