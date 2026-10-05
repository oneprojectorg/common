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
      getProposalEngagement({
        profileId: assignment.proposal.profileId,
        viewerProfileId: assignment.reviewerProfileId,
      }),
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

/**
 * The one proposal's engagement counts, through the same reader the cards use
 * so a reviewer never sees a different number than the list does.
 */
async function getProposalEngagement({
  profileId,
  viewerProfileId,
}: {
  profileId: string;
  viewerProfileId: string;
}) {
  const relationshipData = await getProposalRelationshipData({
    profileIds: [profileId],
    currentProfileId: viewerProfileId,
  });

  // The map carries an entry per requested id, so this never falls through.
  return relationshipData.get(profileId);
}
