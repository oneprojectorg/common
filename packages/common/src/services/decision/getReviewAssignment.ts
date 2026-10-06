import type { User } from '@op/supabase/lib';

import { ValidationError } from '../../utils';
import { generateProposalHtml } from './generateProposalHtml';
import { getProposalAttachmentsWithSignedUrls } from './getProposalAttachmentsWithSignedUrls';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import {
  assertReviewAssignmentContext,
  canEditSubmittedReview,
  resolveAssignmentProposal,
} from './reviewHelpers';
import {
  type ReviewAssignmentExtended,
  reviewAssignmentExtendedSchema,
} from './schemas/reviews';

/** Returns one authorized review assignment with its rubric template and saved review. */
export async function getReviewAssignment({
  assignmentId,
  user,
}: {
  assignmentId: string;
  user: User;
}): Promise<ReviewAssignmentExtended> {
  const {
    assignment,
    instance,
    isReviewOutOfDate,
    review,
    revisionRequest,
    rubricTemplate,
  } = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  const proposalSnapshot = resolveAssignmentProposal(assignment);

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );

  const [relationshipInfo, documentContentMap, proposalAttachments] =
    await Promise.all([
      // The same reader the cards use, so a reviewer reads the same numbers.
      getProposalRelationshipData({
        profileIds: [assignment.proposal.profileId],
        currentProfileId: assignment.reviewerProfileId,
      }).then((data) => data.get(assignment.proposal.profileId)),
      getProposalDocumentsContent(
        [
          {
            id: proposalSnapshot.id,
            proposalData: proposalSnapshot.proposalData,
            proposalTemplate,
            collaborationDocVersionId:
              proposalSnapshot.proposalData.collaborationDocVersionId,
          },
        ],
        // Tolerate an unavailable document rather than failing the review view.
        { onFetchError: 'omit' },
      ),
      getProposalAttachmentsWithSignedUrls(proposalSnapshot.id),
    ]);

  const documentContent = documentContentMap.get(proposalSnapshot.id);

  // 'omit' keeps a failed fetch out of the map entirely, so a present entry is
  // always real content here; guard 'unavailable' too for type-safety.
  if (!documentContent || documentContent.type === 'unavailable') {
    throw new ValidationError(
      `Could not resolve document content for proposal ${proposalSnapshot.id}`,
    );
  }

  const htmlContent =
    documentContent.type === 'json'
      ? generateProposalHtml(documentContent.fragments)
      : { default: documentContent.content };

  return reviewAssignmentExtendedSchema.parse({
    assignment: {
      ...assignment,
      proposal: {
        ...proposalSnapshot,
        ...relationshipInfo,
        attachments: proposalAttachments,
        proposalTemplate,
        documentContent,
        htmlContent,
      },
    },
    rubricTemplate,
    review,
    revisionRequest,
    canEditReview: canEditSubmittedReview({ assignment, instance, review }),
    isReviewOutOfDate,
  });
}
