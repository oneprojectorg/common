import { and, db, eq, inArray } from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  Visibility,
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

import { UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type {
  ListProposalReviewAssignmentsResult,
  ProposalReviewAssignmentListItem,
} from './schemas/reviewAssignments';

export async function listReviewAssignments({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<ListProposalReviewAssignmentsResult> {
  const [instance, commonUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  if (!commonUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      reviewerProfileId: commonUser.currentProfileId,
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
    },
    orderBy: {
      assignedAt: 'asc',
    },
  });

  const snapshotRows = assignments.map(
    (assignment) => assignment.assignedProposalHistory,
  );
  const snapshotProposalIds = snapshotRows
    .map((snapshot) => snapshot?.id)
    .filter((id): id is string => Boolean(id));
  const snapshotProfileIds = snapshotRows
    .map((snapshot) => snapshot?.profileId)
    .filter((id): id is string => Boolean(id));
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData && typeof instance.instanceData === 'object'
      ? instance.instanceData
      : null,
    instance.process.id,
  );

  const [relationshipResults, documentContentMap, proposalAttachmentsMap] =
    await Promise.all([
      snapshotProfileIds.length > 0
        ? Promise.all([
            db
              .select({
                targetProfileId: profileRelationships.targetProfileId,
                relationshipType: profileRelationships.relationshipType,
                count: countFn(),
              })
              .from(profileRelationships)
              .where(
                inArray(
                  profileRelationships.targetProfileId,
                  snapshotProfileIds,
                ),
              )
              .groupBy(
                profileRelationships.targetProfileId,
                profileRelationships.relationshipType,
              ),
            db
              .select({
                targetProfileId: profileRelationships.targetProfileId,
                relationshipType: profileRelationships.relationshipType,
              })
              .from(profileRelationships)
              .where(
                and(
                  eq(
                    profileRelationships.sourceProfileId,
                    commonUser.currentProfileId,
                  ),
                  inArray(
                    profileRelationships.targetProfileId,
                    snapshotProfileIds,
                  ),
                ),
              ),
            db
              .select({
                profileId: postsToProfiles.profileId,
                count: countFn(),
              })
              .from(posts)
              .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
              .where(inArray(postsToProfiles.profileId, snapshotProfileIds))
              .groupBy(postsToProfiles.profileId),
          ])
        : Promise.resolve(null),
      getProposalDocumentsContent(
        assignments.flatMap((assignment) => {
          if (!assignment.assignedProposalHistory) {
            return [];
          }

          const parsedProposalData = parseProposalData(
            assignment.assignedProposalHistory.proposalData,
          );

          if (!parsedProposalData.collaborationDocId) {
            throw new ValidationError(
              `Assigned proposal snapshot ${assignment.assignedProposalHistory.historyId} is missing collaborationDocId`,
            );
          }

          if (parsedProposalData.collaborationDocVersionId == null) {
            console.warn(
              `[listReviewAssignments] Assigned proposal snapshot ${assignment.assignedProposalHistory.historyId} is missing collaborationDocVersionId`,
            );
          }

          return {
            id: assignment.assignedProposalHistory.historyId,
            proposalData: assignment.assignedProposalHistory.proposalData,
            proposalTemplate,
            collaborationDocVersionId:
              parsedProposalData.collaborationDocVersionId,
          };
        }),
      ),
      snapshotProposalIds.length > 0
        ? getReviewProposalAttachments(snapshotProposalIds)
        : Promise.resolve(new Map()),
    ]);

  const relationshipData = new Map<
    string,
    {
      likesCount: number;
      followersCount: number;
      isLikedByUser: boolean;
      isFollowedByUser: boolean;
      commentsCount: number;
    }
  >();

  if (relationshipResults) {
    const [relationshipCounts, userRelationships, commentCounts] =
      relationshipResults;

    for (const profileId of snapshotProfileIds) {
      relationshipData.set(profileId, {
        likesCount: Number(
          relationshipCounts.find(
            (row) =>
              row.targetProfileId === profileId &&
              row.relationshipType === ProfileRelationshipType.LIKES,
          )?.count ?? 0,
        ),
        followersCount: Number(
          relationshipCounts.find(
            (row) =>
              row.targetProfileId === profileId &&
              row.relationshipType === ProfileRelationshipType.FOLLOWING,
          )?.count ?? 0,
        ),
        isLikedByUser: userRelationships.some(
          (row) =>
            row.targetProfileId === profileId &&
            row.relationshipType === ProfileRelationshipType.LIKES,
        ),
        isFollowedByUser: userRelationships.some(
          (row) =>
            row.targetProfileId === profileId &&
            row.relationshipType === ProfileRelationshipType.FOLLOWING,
        ),
        commentsCount: Number(
          commentCounts.find((row) => row.profileId === profileId)?.count ?? 0,
        ),
      });
    }
  }

  const assignmentList = assignments.map((assignment) => {
    const snapshot = assignment.assignedProposalHistory;

    if (!snapshot) {
      throw new UnauthorizedError('Assigned proposal snapshot not found');
    }

    const relationshipInfo = relationshipData.get(snapshot.profileId);
    const documentContent = documentContentMap.get(snapshot.historyId);
    const parsedProposalData = parseProposalData(snapshot.proposalData);

    let htmlContent: Record<string, string> | undefined;
    if (documentContent?.type === 'json') {
      htmlContent = generateProposalHtml(documentContent.fragments);
    } else if (documentContent?.type === 'html') {
      htmlContent = { default: documentContent.content };
    }

    return {
      id: assignment.id,
      processInstanceId: assignment.processInstanceId,
      phaseId: assignment.phaseId,
      status: assignment.status as ProposalReviewAssignmentStatus,
      proposal: {
        id: snapshot.id,
        processInstanceId: snapshot.processInstanceId,
        proposalData: parsedProposalData,
        status: snapshot.status as ProposalStatus | null,
        visibility: snapshot.visibility as Visibility,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        profileId: snapshot.profileId,
        submittedBy: snapshot.submittedBy,
        profile: snapshot.profile,
        likesCount: relationshipInfo?.likesCount ?? 0,
        followersCount: relationshipInfo?.followersCount ?? 0,
        commentsCount: relationshipInfo?.commentsCount ?? 0,
        isLikedByUser: relationshipInfo?.isLikedByUser ?? false,
        isFollowedByUser: relationshipInfo?.isFollowedByUser ?? false,
        attachments: proposalAttachmentsMap.get(snapshot.id) ?? [],
        proposalTemplate,
        documentContent,
        htmlContent,
      } as ProposalReviewAssignmentListItem['proposal'],
    };
  });

  return {
    assignments: assignmentList,
    total: assignmentList.length,
    completed: assignmentList.filter(
      (assignment) =>
        assignment.status === ProposalReviewAssignmentStatus.COMPLETED,
    ).length,
  };
}

async function getReviewProposalAttachments(proposalIds: string[]) {
  const proposalAttachmentRows = await db
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

  type ReviewProposalAttachmentRow = (typeof proposalAttachmentRows)[number];
  type ReviewProposalAttachment = Omit<
    ReviewProposalAttachmentRow,
    'attachment'
  > & {
    attachment: Omit<
      ReviewProposalAttachmentRow['attachment'],
      'storagePath'
    > & {
      url?: string;
    };
  };

  if (proposalAttachmentRows.length === 0) {
    return new Map<string, ReviewProposalAttachment[]>();
  }

  const supabase = createSBServiceClient();
  const attachmentsWithUrls: ReviewProposalAttachment[] = await Promise.all(
    proposalAttachmentRows.map(async (attachmentRow) => {
      const storagePath = attachmentRow.attachment.storagePath;

      if (!storagePath) {
        return attachmentRow;
      }

      const { data } = await supabase.storage
        .from('assets')
        .createSignedUrl(storagePath, 60 * 60 * 24);

      return {
        ...attachmentRow,
        attachment: {
          id: attachmentRow.attachment.id,
          postId: attachmentRow.attachment.postId,
          storageObjectId: attachmentRow.attachment.storageObjectId,
          fileName: attachmentRow.attachment.fileName,
          mimeType: attachmentRow.attachment.mimeType,
          fileSize: attachmentRow.attachment.fileSize,
          uploadedBy: attachmentRow.attachment.uploadedBy,
          profileId: attachmentRow.attachment.profileId,
          createdAt: attachmentRow.attachment.createdAt,
          updatedAt: attachmentRow.attachment.updatedAt,
          url: data?.signedUrl,
        },
      };
    }),
  );

  const attachmentsByProposalId = new Map<string, ReviewProposalAttachment[]>();

  for (const attachmentRow of attachmentsWithUrls) {
    const existingAttachments =
      attachmentsByProposalId.get(attachmentRow.proposalId) ?? [];
    existingAttachments.push(attachmentRow);
    attachmentsByProposalId.set(attachmentRow.proposalId, existingAttachments);
  }

  return attachmentsByProposalId;
}
