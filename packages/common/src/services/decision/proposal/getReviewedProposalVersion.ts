import { type DbClient, and, db as defaultDb, eq, isNull } from '@op/db/client';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError } from '../../../utils';
import { generateProposalHtml } from '../generateProposalHtml';
import { getInstance } from '../getInstance';
import { getProposalAttachmentsWithSignedUrls } from '../getProposalAttachmentsWithSignedUrls';
import {
  type ProposalDocumentContent,
  getProposalDocumentsContent,
} from '../getProposalDocumentsContent';
import { isAnonymousAuthor } from '../proposalAuthor';
import { parseProposalData } from '../proposalDataSchema';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import {
  type ReviewedProposalVersion,
  reviewedProposalVersionSchema,
} from '../schemas/proposal';
import { getCurrentProposalHistoryIdForAssignment } from './history';

export const getReviewedProposalVersionInputSchema = z.object({
  reviewId: z.uuid(),
});

export type GetReviewedProposalVersionInput = z.infer<
  typeof getReviewedProposalVersionInputSchema
>;

/**
 * The proposal as it stood when this review was written: the review's own
 * version anchor, falling back to the assignment pin for reviews written
 * before the anchor column existed. The caller never names a version — the
 * pointers stay server-side (ADR 0006).
 *
 * `isCurrent` is true when the anchor resolves to the proposal's current
 * history row, when there is no anchor at all, and when the proposal has no
 * open history row to compare against; in every one of those cases the live
 * proposal is returned, so live content is never labelled an older version.
 */
export async function getReviewedProposalVersion({
  reviewId,
  user,
  db = defaultDb,
}: {
  reviewId: string;
  user: User;
  db?: DbClient;
}): Promise<ReviewedProposalVersion> {
  const review = await db.query.proposalReviews.findFirst({
    where: { id: reviewId },
    columns: { id: true, reviewedProposalHistoryId: true },
    with: {
      assignment: {
        columns: {
          id: true,
          proposalId: true,
          processInstanceId: true,
          phaseId: true,
          assignedProposalHistoryId: true,
        },
      },
    },
  });

  if (!review) {
    throw new NotFoundError('Review', reviewId);
  }

  const { assignment } = review;

  const instance = await getInstance({
    instanceId: assignment.processInstanceId,
    user,
  });

  // Same gate as the admin review reads: decision admins on any phase,
  // reviewers on an open-reviews phase at or before the current one.
  await assertCanReadPhaseReviews({
    instance,
    phaseId: assignment.phaseId,
    user,
  });

  const anchorHistoryId =
    review.reviewedProposalHistoryId ?? assignment.assignedProposalHistoryId;

  const [proposal, currentProposalHistoryId, snapshot] = await Promise.all([
    db.query.proposals.findFirst({
      // Moderation-detached (CSAM) proposals are treated as not-found even for
      // admins — same 404 every other proposal read returns.
      where: {
        RAW: (table) =>
          and(
            eq(table.id, assignment.proposalId),
            isNull(table.moderationDetachedAt),
          )!,
      },
      with: {
        profile: true,
        submittedBy: {
          with: {
            avatarImage: true,
            profileUsers: {
              columns: {},
              with: { authUser: { columns: { isAnonymous: true } } },
            },
          },
        },
      },
    }),
    getCurrentProposalHistoryIdForAssignment({ assignment, db }),
    anchorHistoryId
      ? db.query.proposalHistory.findFirst({
          where: { historyId: anchorHistoryId },
        })
      : Promise.resolve(undefined),
  ]);

  if (!proposal) {
    throw new NotFoundError('Proposal', assignment.proposalId);
  }

  // The anchor columns reference `history_id` alone, so the schema cannot stop
  // a review from naming another proposal's snapshot (see the comment on
  // `proposalReviews`). Refuse rather than serve a foreign proposal's content.
  if (snapshot && snapshot.id !== assignment.proposalId) {
    logger.warn('Review version anchor names another proposal', {
      reviewId,
      assignmentId: assignment.id,
      proposalId: assignment.proposalId,
    });
    throw new NotFoundError('Proposal version', reviewId);
  }

  const isCurrent =
    !snapshot ||
    !currentProposalHistoryId ||
    snapshot.historyId === currentProposalHistoryId;
  const versionRow = snapshot && !isCurrent ? snapshot : proposal;
  const proposalData = parseProposalData(versionRow.proposalData);

  // An older snapshot whose collaboration doc was never version-stamped (the
  // stamp on submit is best-effort) cannot be rendered as it was — fetching it
  // would return today's document under an "older version" label.
  const contentUnavailable =
    !isCurrent &&
    Boolean(proposalData.collaborationDocId) &&
    proposalData.collaborationDocVersionId == null;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );

  const [documentContentMap, attachments] = await Promise.all([
    contentUnavailable
      ? Promise.resolve(new Map<string, ProposalDocumentContent>())
      : getProposalDocumentsContent(
          [
            {
              id: proposal.id,
              proposalData,
              proposalTemplate,
              collaborationDocVersionId: proposalData.collaborationDocVersionId,
            },
          ],
          { onFetchError: 'unavailable' },
        ),
    // Attachments are not versioned — the history row carries proposal columns
    // only — so they always come from the current proposal.
    getProposalAttachmentsWithSignedUrls(proposal.id),
  ]);

  const documentContent = documentContentMap.get(proposal.id);

  let htmlContent: Record<string, string> | undefined;
  if (documentContent?.type === 'json') {
    htmlContent = generateProposalHtml(documentContent.fragments);
  } else if (documentContent?.type === 'html') {
    htmlContent = { default: documentContent.content };
  }

  const { profileUsers, ...submittedBy } = proposal.submittedBy;

  return reviewedProposalVersionSchema.parse({
    proposal: {
      ...versionRow,
      id: proposal.id,
      profileId: proposal.profileId,
      proposalData,
      // Profiles are not versioned; the author and owning group are read live.
      submittedBy: {
        ...submittedBy,
        isAnonymous: isAnonymousAuthor(profileUsers),
      },
      profile: proposal.profile,
      attachments,
      proposalTemplate,
      documentContent,
      htmlContent,
    },
    isCurrent,
    contentUnavailable,
  });
}
