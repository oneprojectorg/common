import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalAttachmentsWithSignedUrls } from './getProposalAttachmentsWithSignedUrls';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import {
  type ReviewAssignmentList,
  reviewAssignmentListSchema,
} from './schemas/reviews';

/** Returns all authorized review assignments for the current reviewer in a process instance. */
export async function listReviewAssignments({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
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
    },
    with: {
      assignedProposalHistory: {
        with: {
          submittedBy: {
            with: {
              avatarImage: true,
            },
          },
          profile: true,
        },
      },
      proposal: {
        with: {
          submittedBy: {
            with: {
              avatarImage: true,
            },
          },
          profile: true,
        },
      },
      reviews: true,
    },
    orderBy: {
      assignedAt: 'asc',
    },
  });

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );
  const rubricTemplate = instance.instanceData.rubricTemplate ?? null;

  const proposalIds: string[] = [];
  const docContentInputs: Array<{
    id: string;
    proposalData: unknown;
    proposalTemplate: typeof proposalTemplate;
    collaborationDocVersionId?: number;
  }> = [];

  for (const assignment of assignments) {
    const proposalHistory = assignment.assignedProposalHistory;
    const proposalSnapshot = proposalHistory ?? assignment.proposal;

    const proposalId = proposalSnapshot.id;
    const contentId = proposalHistory
      ? proposalHistory.historyId
      : proposalSnapshot.id;

    proposalIds.push(proposalId);

    const parsedData = parseProposalData(proposalSnapshot.proposalData);

    if (!parsedData.collaborationDocId) {
      throw new ValidationError(
        `Proposal ${contentId} is missing collaborationDocId`,
      );
    }

    if (parsedData.collaborationDocVersionId == null) {
      console.warn(
        `[listReviewAssignments] Proposal ${contentId} is missing collaborationDocVersionId`,
      );
    }

    docContentInputs.push({
      id: contentId,
      proposalData: proposalSnapshot.proposalData,
      proposalTemplate,
      collaborationDocVersionId: parsedData.collaborationDocVersionId,
    });
  }

  const [documentContentMap, attachmentsByProposal] = await Promise.all([
    getProposalDocumentsContent(docContentInputs),
    proposalIds.length > 0
      ? getBatchedAttachments(proposalIds)
      : new Map<
          string,
          Awaited<ReturnType<typeof getProposalAttachmentsWithSignedUrls>>
        >(),
  ]);

  const assignmentList = assignments.map((assignment) => {
    const proposalHistory = assignment.assignedProposalHistory;
    const proposalSnapshot = proposalHistory ?? assignment.proposal;

    const proposalId = proposalSnapshot.id;
    const contentId = proposalHistory
      ? proposalHistory.historyId
      : proposalSnapshot.id;

    const parsedProposalData = parseProposalData(proposalSnapshot.proposalData);
    const documentContent = documentContentMap.get(contentId);
    const proposalAttachments = attachmentsByProposal.get(proposalId) ?? [];

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
          proposalData: parsedProposalData,
          attachments: proposalAttachments,
          proposalTemplate,
          documentContent,
          htmlContent,
        },
      },
      rubricTemplate,
      review: assignment.reviews[0] ?? null,
    };
  });

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
  });
}

/** Fetches attachments with signed URLs for a batch of proposal IDs. */
async function getBatchedAttachments(proposalIds: string[]) {
  const results = await Promise.all(
    proposalIds.map(async (proposalId) => ({
      proposalId,
      attachments: await getProposalAttachmentsWithSignedUrls(proposalId),
    })),
  );

  const map = new Map<
    string,
    Awaited<ReturnType<typeof getProposalAttachmentsWithSignedUrls>>
  >();
  for (const { proposalId, attachments } of results) {
    map.set(proposalId, attachments);
  }
  return map;
}
