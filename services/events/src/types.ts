import { ProposalFilter } from '@op/core';
import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

// Mirrors the db `moderation_item_type` enum values; kept as a plain string
// union so it flows cleanly through the service layer without enum coercion.
const moderationItemType = z.enum(['proposal', 'post', 'user']);

export const Events = {
  // Carries only the item ref: the workflow resolves the item's current text
  // and attachments itself at review time. Snapshotting content into the
  // event was wrong for collab-doc proposals (their prose lives in TipTap
  // fragments, not proposalData) and would review stale text after edits.
  contentSubmitted: {
    name: 'content/submitted' as const,
    schema: z.object({
      itemType: moderationItemType,
      itemId: z.string().uuid(),
    }),
  },
  contentFlagged: {
    name: 'content/flagged' as const,
    schema: z.object({
      itemType: moderationItemType,
      itemId: z.string().uuid(),
      moderationFlagId: z.string().uuid(),
    }),
  },
  postReactionAdded: {
    name: 'post/reaction-added' as const,
    schema: z.object({
      sourceProfileId: z.string(),
      postId: z.string(),
      reactionType: z.string(),
    }),
  },
  proposalExportRequested: {
    name: 'proposal/export-requested' as const,
    schema: z.object({
      exportId: z.string().uuid(),
      processInstanceId: z.string().uuid(),
      userId: z.string().uuid(),
      format: z.enum(['csv']),
      filters: z.object({
        categoryId: z.string().optional(),
        submittedByProfileId: z.string().optional(),
        status: z.enum(ProposalStatus).optional(),
        dir: z.enum(['asc', 'desc']),
        proposalFilter: z.enum(ProposalFilter).optional(),
      }),
    }),
  },
  profileInviteSent: {
    name: 'profile/invites-sent' as const,
    schema: z.object({
      senderProfileId: z.string(),
      inviteIds: z.array(z.string()).optional(),
      invitations: z.array(
        z.object({
          email: z.string().email(),
          inviterName: z.string(),
          profileName: z.string(),
          inviteUrl: z.string().url(),
          personalMessage: z.string().optional(),
        }),
      ),
    }),
  },
  proposalSubmitted: {
    name: 'proposal/submitted' as const,
    schema: z.object({
      proposalId: z.string().uuid(),
    }),
  },
  // Emitted only for decision profiles. Role-id arrays are a narrowing hint —
  // consumers must re-derive state from the DB.
  decisionMemberRolesChanged: {
    name: 'decision/member-roles-changed' as const,
    schema: z.object({
      decisionProfileId: z.string().uuid(),
      authUserId: z.string().uuid(),
      addedRoleIds: z.array(z.string().uuid()),
      removedRoleIds: z.array(z.string().uuid()),
    }),
  },
  phaseTransitioned: {
    name: 'decision/phase-transitioned' as const,
    schema: z.object({
      processInstanceId: z.string().uuid(),
      fromPhaseId: z.string().min(1),
      toPhaseId: z.string().min(1),
    }),
  },
  manualSelectionsConfirmed: {
    name: 'decision/manual-selections-confirmed' as const,
    schema: z.object({
      processInstanceId: z.string().uuid(),
      fromPhaseId: z.string().min(1),
      toPhaseId: z.string().min(1),
    }),
  },
  // Emitted after processResults writes a successful result row. Carries the
  // row id so consumers can detect when a newer run has superseded it.
  resultsProcessed: {
    name: 'decision/results-processed' as const,
    schema: z.object({
      processInstanceId: z.string().uuid(),
      processResultId: z.string().uuid(),
    }),
  },
  voteSubmitted: {
    name: 'vote/submitted' as const,
    schema: z.object({
      voteSubmissionId: z.string().uuid(),
      processInstanceId: z.string().uuid(),
    }),
  },
  reviewRevisionResubmitted: {
    name: 'review/revision-resubmitted' as const,
    schema: z.object({
      assignmentId: z.string().uuid(),
      revisionRequestId: z.string().uuid(),
    }),
  },
  reviewRevisionRequested: {
    name: 'review/revision-requested' as const,
    schema: z.object({
      assignmentId: z.string().uuid(),
      revisionRequestId: z.string().uuid(),
    }),
  },
  decisionUpdatePosted: {
    name: 'decision/update-posted' as const,
    schema: z.object({
      postId: z.string().uuid(),
      targetProfileId: z.string().uuid(),
      authorProfileId: z.string().uuid(),
    }),
  },
  commentPosted: {
    name: 'comment/posted' as const,
    schema: z.object({
      postId: z.string().uuid(),
      parentPostId: z.string().uuid(),
      authorProfileId: z.string().uuid(),
    }),
  },
  proposalCommentPosted: {
    name: 'proposalComment/posted' as const,
    schema: z.object({
      postId: z.string().uuid(),
      proposalId: z.string().uuid(),
      authorProfileId: z.string().uuid(),
    }),
  },
} as const;
