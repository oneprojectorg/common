import { type DbClient, and, db as defaultDb, eq } from '@op/db/client';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError } from '../../../utils';
import { getProfileAccessRoles } from '../../access';
import { generateProposalHtml } from '../generateProposalHtml';
import { getInstance } from '../getInstance';
import { getProposalAttachmentsWithSignedUrls } from '../getProposalAttachmentsWithSignedUrls';
import {
  type ProposalDocumentContent,
  getProposalDocumentsContent,
} from '../getProposalDocumentsContent';
import { isAnonymousAuthor } from '../proposalAuthor';
import { parseProposalData } from '../proposalDataSchema';
import {
  getProposalReadContext,
  isProposalReadable,
} from '../proposalVisibility';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import { resolveReviewedProposalHistoryId } from '../review/staleness';
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
 * The proposal as it stood when this review was written. The caller names a
 * review and never a version — the history pointers stay server-side (ADR
 * 0006). `isCurrent` is true when the live proposal was returned.
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

  const [decisionRoles] = await Promise.all([
    instance.profileId
      ? getProfileAccessRoles({ user, profileId: instance.profileId })
      : Promise.resolve([]),
    assertCanReadPhaseReviews({
      instance,
      phaseId: assignment.phaseId,
      user,
    }),
  ]);

  // Reading a review does not widen who may read its proposal: drafts, hidden,
  // flagged and detached proposals stay behind exactly the gate `getProposal`
  // applies.
  const readContext = getProposalReadContext({ user, decisionRoles });

  const anchorHistoryId = resolveReviewedProposalHistoryId({
    review,
    assignment,
  });

  // One repeatable-read snapshot: a revision landing between the proposal read
  // and the current-history read would otherwise let `isCurrent` describe a
  // different version than the content returned with it.
  const { proposal, currentProposalHistoryId, snapshot } = await db.transaction(
    async (tx) => ({
      proposal: await tx.query.proposals.findFirst({
        where: {
          RAW: (table) =>
            and(
              eq(table.id, assignment.proposalId),
              isProposalReadable(table, readContext),
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
      currentProposalHistoryId: await getCurrentProposalHistoryIdForAssignment({
        assignment,
        db: tx,
      }),
      snapshot: anchorHistoryId
        ? await tx.query.proposalHistory.findFirst({
            where: { historyId: anchorHistoryId },
          })
        : undefined,
    }),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );

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

  // Fetching an older snapshot's collaboration document without a version
  // stamp would return today's document under an older-version label.
  const documentUnstamped =
    !isCurrent &&
    Boolean(proposalData.collaborationDocId) &&
    proposalData.collaborationDocVersionId == null;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );

  const [documentContentMap, attachments] = await Promise.all([
    documentUnstamped
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

  const documentContent: ProposalDocumentContent | undefined = documentUnstamped
    ? { type: 'unavailable' }
    : documentContentMap.get(proposal.id);

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
  });
}
