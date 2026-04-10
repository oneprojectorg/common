import { and, db, eq } from '@op/db/client';
import {
  ProfileRelationshipType,
  posts,
  postsToProfiles,
  profileRelationships,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';

import { ValidationError } from '../../utils';
import { generateProposalHtml } from './generateProposalHtml';
import { getProposalAttachmentsWithSignedUrls } from './getProposalAttachmentsWithSignedUrls';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { assertReviewAssignmentContext } from './reviewHelpers';
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
  const { assignment, instance, review, rubricTemplate } =
    await assertReviewAssignmentContext({
      assignmentId,
      user,
    });

  const proposalHistory = assignment.assignedProposalHistory;
  const proposalSnapshot = proposalHistory ?? assignment.proposal;

  const proposalId = proposalSnapshot.id;
  const contentId = proposalHistory
    ? proposalHistory.historyId
    : proposalSnapshot.id;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );
  const parsedProposalData = parseProposalData(proposalSnapshot.proposalData);

  if (!parsedProposalData.collaborationDocId) {
    throw new ValidationError(
      `Proposal ${contentId} is missing collaborationDocId`,
    );
  }

  if (parsedProposalData.collaborationDocVersionId == null) {
    console.warn(
      `[getReviewAssignment] Proposal ${contentId} is missing collaborationDocVersionId`,
    );
  }

  const [relationshipInfo, documentContentMap, proposalAttachments] =
    await Promise.all([
      getProposalRelationshipInfo({
        profileId: proposalSnapshot.profileId,
        viewerProfileId: assignment.reviewerProfileId,
      }),
      getProposalDocumentsContent([
        {
          id: contentId,
          proposalData: proposalSnapshot.proposalData,
          proposalTemplate,
          collaborationDocVersionId:
            parsedProposalData.collaborationDocVersionId,
        },
      ]),
      getProposalAttachmentsWithSignedUrls(proposalId),
    ]);

  const documentContent = documentContentMap.get(contentId);

  if (!documentContent) {
    throw new ValidationError(
      `Could not resolve document content for proposal ${contentId}`,
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
        proposalData: parsedProposalData,
        ...relationshipInfo,
        attachments: proposalAttachments,
        proposalTemplate,
        documentContent,
        htmlContent,
      },
    },
    rubricTemplate,
    review,
  });
}

async function getProposalRelationshipInfo({
  profileId,
  viewerProfileId,
}: {
  profileId: string;
  viewerProfileId: string;
}) {
  const [relationshipCounts, userRelationships, commentCounts] =
    await Promise.all([
      db
        .select({
          relationshipType: profileRelationships.relationshipType,
          count: countFn(),
        })
        .from(profileRelationships)
        .where(eq(profileRelationships.targetProfileId, profileId))
        .groupBy(profileRelationships.relationshipType),
      db
        .select({
          relationshipType: profileRelationships.relationshipType,
        })
        .from(profileRelationships)
        .where(
          and(
            eq(profileRelationships.sourceProfileId, viewerProfileId),
            eq(profileRelationships.targetProfileId, profileId),
          ),
        ),
      db
        .select({
          count: countFn(),
        })
        .from(posts)
        .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
        .where(eq(postsToProfiles.profileId, profileId)),
    ]);

  return {
    likesCount: Number(
      relationshipCounts.find(
        (row) => row.relationshipType === ProfileRelationshipType.LIKES,
      )?.count ?? 0,
    ),
    followersCount: Number(
      relationshipCounts.find(
        (row) => row.relationshipType === ProfileRelationshipType.FOLLOWING,
      )?.count ?? 0,
    ),
    isLikedByUser: userRelationships.some(
      (row) => row.relationshipType === ProfileRelationshipType.LIKES,
    ),
    isFollowedByUser: userRelationships.some(
      (row) => row.relationshipType === ProfileRelationshipType.FOLLOWING,
    ),
    commentsCount: Number(commentCounts[0]?.count ?? 0),
  };
}
