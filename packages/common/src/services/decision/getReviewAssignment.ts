import { and, db, eq, inArray } from '@op/db/client';
import {
  ProfileRelationshipType,
  attachments,
  objectsInStorage,
  posts,
  postsToProfiles,
  profileRelationships,
  proposalAttachments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { count as countFn } from 'drizzle-orm';

import { NotFoundError, ValidationError } from '../../utils';
import { generateProposalHtml } from './generateProposalHtml';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { getAuthorizedReviewAssignmentContext } from './reviewHelpers';
import {
  type ReviewAssignmentDetail,
  reviewAssignmentDetailSchema,
} from './schemas/reviews';

/** Returns one authorized review assignment with its rubric template and saved review. */
export async function getReviewAssignment({
  assignmentId,
  user,
}: {
  assignmentId: string;
  user: User;
}): Promise<ReviewAssignmentDetail> {
  const context = await getAuthorizedReviewAssignmentContext({
    assignmentId,
    user,
  });

  const assignment = await db.query.proposalReviewAssignments.findFirst({
    where: {
      id: assignmentId,
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
      reviews: true,
    },
  });

  if (!assignment?.assignedProposalHistory) {
    throw new NotFoundError('Assigned proposal snapshot');
  }

  const snapshot = assignment.assignedProposalHistory;
  const proposalTemplate = await resolveProposalTemplate(
    context.instance.instanceData &&
      typeof context.instance.instanceData === 'object'
      ? context.instance.instanceData
      : null,
    context.instance.process.id,
  );
  const parsedProposalData = parseProposalData(snapshot.proposalData);

  if (!parsedProposalData.collaborationDocId) {
    throw new ValidationError(
      `Assigned proposal snapshot ${snapshot.historyId} is missing collaborationDocId`,
    );
  }

  if (parsedProposalData.collaborationDocVersionId == null) {
    console.warn(
      `[getReviewAssignment] Assigned proposal snapshot ${snapshot.historyId} is missing collaborationDocVersionId`,
    );
  }

  const [relationshipInfo, documentContentMap, proposalAttachmentsMap] =
    await Promise.all([
      getProposalRelationshipInfo({
        profileId: snapshot.profileId,
        viewerProfileId: assignment.reviewerProfileId,
      }),
      getProposalDocumentsContent([
        {
          id: snapshot.historyId,
          proposalData: snapshot.proposalData,
          proposalTemplate,
          collaborationDocVersionId:
            parsedProposalData.collaborationDocVersionId,
        },
      ]),
      getReviewProposalAttachments([snapshot.id]),
    ]);

  const documentContent = documentContentMap.get(snapshot.historyId);
  let htmlContent: Record<string, string> | undefined;

  if (documentContent?.type === 'json') {
    htmlContent = generateProposalHtml(documentContent.fragments);
  } else if (documentContent?.type === 'html') {
    htmlContent = { default: documentContent.content };
  }

  const review = assignment.reviews[0] ?? null;

  return reviewAssignmentDetailSchema.parse({
    assignment: {
      ...assignment,
      proposal: {
        ...snapshot,
        proposalData: parsedProposalData,
        ...relationshipInfo,
        attachments: proposalAttachmentsMap.get(snapshot.id) ?? [],
        proposalTemplate,
        documentContent,
        htmlContent,
      },
    },
    rubricTemplate: context.rubricTemplate,
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

async function getReviewProposalAttachments(proposalIds: string[]) {
  const rows = await db
    .select({
      id: proposalAttachments.id,
      proposalId: proposalAttachments.proposalId,
      attachmentId: proposalAttachments.attachmentId,
      uploadedBy: proposalAttachments.uploadedBy,
      createdAt: proposalAttachments.createdAt,
      updatedAt: proposalAttachments.updatedAt,
      attachment: {
        id: attachments.id,
        postId: attachments.postId,
        storageObjectId: attachments.storageObjectId,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        fileSize: attachments.fileSize,
        uploadedBy: attachments.uploadedBy,
        profileId: attachments.profileId,
        createdAt: attachments.createdAt,
        updatedAt: attachments.updatedAt,
        storagePath: objectsInStorage.name,
      },
    })
    .from(proposalAttachments)
    .innerJoin(
      attachments,
      eq(proposalAttachments.attachmentId, attachments.id),
    )
    .leftJoin(
      objectsInStorage,
      eq(attachments.storageObjectId, objectsInStorage.id),
    )
    .where(inArray(proposalAttachments.proposalId, proposalIds));

  if (rows.length === 0) {
    return new Map<string, (typeof resolved)[number][]>();
  }

  const supabase = createSBServiceClient();
  const resolved = await Promise.all(
    rows.map(async (row) => {
      const { storagePath, ...rest } = row.attachment;
      if (!storagePath) {
        return { ...row, attachment: { ...rest, url: undefined } };
      }
      const { data } = await supabase.storage
        .from('assets')
        .createSignedUrl(storagePath, 60 * 60 * 24);
      return { ...row, attachment: { ...rest, url: data?.signedUrl } };
    }),
  );

  const byProposalId = new Map<string, (typeof resolved)[number][]>();
  for (const row of resolved) {
    const list = byProposalId.get(row.proposalId) ?? [];
    list.push(row);
    byProposalId.set(row.proposalId, list);
  }
  return byProposalId;
}
