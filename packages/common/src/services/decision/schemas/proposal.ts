import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

import { PAGE_LIMIT } from '../../../utils/pagination';
import {
  PROPOSAL_TITLE_MAX_LENGTH,
  proposalDataSchema,
} from '../proposalDataSchema';

export const storageItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z
    .object({
      eTag: z.string(),
      size: z.number(),
      mimetype: z.string(),
      cacheControl: z.string(),
      lastModified: z.string(),
      contentLength: z.number(),
      httpStatusCode: z.number(),
    })
    .nullish(),
});

/**
 * An individual embedded in a proposal (submitter, reviewer). Only the fields
 * the UI actually renders: the avatar, the display name, and the slug used to
 * link to the profile page. Deliberately excludes email and other profile
 * detail (bio, location, website, pronouns, etc.) so we neither leak PII nor
 * ship data the client never reads.
 */
export const proposalProfileSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  avatarImage: storageItemSchema.nullish(),
});

export type ProposalProfile = z.infer<typeof proposalProfileSchema>;

/**
 * A proposal's owning group/org profile as embedded in proposals. The UI only
 * ever renders its display name; navigation uses the sibling `profileId`.
 */
export const proposalGroupProfileSchema = z.object({
  name: z.string(),
});

export type ProposalGroupProfile = z.infer<typeof proposalGroupProfileSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  postId: z.string().nullable(),
  storageObjectId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
  uploadedBy: z.string().nullable(),
  profileId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  url: z.string().optional(),
});

export const proposalAttachmentSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  attachmentId: z.string(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  attachment: attachmentSchema.optional(),
});

export type ProposalAttachment = z.infer<typeof proposalAttachmentSchema>;

export const documentContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('json'),
    fragments: z.record(
      z.string(),
      z.object({
        type: z.string().optional(),
        content: z.array(z.unknown()).optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('html'),
    content: z.string(),
  }),
  // The document fetch failed; the client polls and shows a bounded
  // "content not found" fallback rather than flashing an error immediately.
  z.object({
    type: z.literal('unavailable'),
  }),
]);

export const proposalAccessSchema = z.object({
  delete: z.boolean(),
  update: z.boolean(),
  read: z.boolean(),
  create: z.boolean(),
  admin: z.boolean(),
  inviteMembers: z.boolean(),
  review: z.boolean(),
  submitProposals: z.boolean(),
  vote: z.boolean(),
});

/**
 * Zod schema for the proposal shape returned by the API.
 *
 * This is the source of truth for the `Proposal` type across the monorepo.
 */
export const proposalSchema = z.object({
  id: z.string().uuid(),
  processInstanceId: z.string().uuid(),
  proposalData: proposalDataSchema,
  // Timestamps are serialized as strings (drizzle timestamp mode:'string')
  status: z.string().nullish(),
  visibility: z.string(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  profileId: z.string().uuid(),
  submittedBy: proposalProfileSchema
    .extend({ isAnonymous: z.boolean().optional() })
    .optional(),
  profile: proposalGroupProfileSchema,
  decisionCount: z.number().optional(),
  likesCount: z.number().optional(),
  followersCount: z.number().optional(),
  commentsCount: z.number().optional(),
  isLikedByUser: z.boolean().optional(),
  isFollowedByUser: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  /** True when this proposal is in the latest results selection set. */
  isSelected: z.boolean().optional(),
  /** True when an active moderation flag hides this proposal from general
   *  readers. Only the creator (+ collaborators) and admins ever receive a
   *  flagged proposal, so this drives their "Flagged" indicator. */
  isFlagged: z.boolean().optional(),
  access: proposalAccessSchema.optional(),
  attachments: z.array(proposalAttachmentSchema).optional(),
  selectionRank: z.number().nullable().optional(),
  voteCount: z.number().nullable().optional(),
  allocated: z.string().nullable().optional(),
  proposalTemplate: z.record(z.string(), z.unknown()).nullable().optional(),
  /**
   * Server-computed plain-text preview of the document body. List reads ship
   * this instead of the full `documentContent` fragments — the card's 3-line
   * excerpt and the language-detection sample both read from it.
   */
  previewText: z.string().optional(),
  documentContent: documentContentSchema.optional(),
  htmlContent: z.record(z.string(), z.string()).optional(),
});

export type Proposal = z.infer<typeof proposalSchema>;

/** Paginated proposal list as returned by the API. */
export const proposalListSchema = z.object({
  proposals: z.array(proposalSchema),
  total: z.number(),
  hasMore: z.boolean(),
  canManageProposals: z.boolean().prefault(false),
  // Cursor for the next page, or `null` when there are no further pages.
  next: z.string().nullable(),
});

export type ProposalList = z.infer<typeof proposalListSchema>;

/**
 * Cap on a proposal title search, in characters. Matches the title cap it
 * searches against — a term longer than any title it could match is only cost.
 */
export const PROPOSAL_SEARCH_MAX_LENGTH = PROPOSAL_TITLE_MAX_LENGTH;

/**
 * Page size for every infinite proposal-card list — the browse grid and the
 * reviewer's queue. A multiple of three so a full page fills the
 * three-per-row grid evenly, and kept small because the server-side cost of a
 * page scales with it (the reviewer's queue renders each proposal's document,
 * which is what ran the function out of memory unpaginated).
 *
 * One constant so the two lists cannot drift; lives here rather than in the
 * client component because the reviewer's queue defaults to it server-side and
 * a client that sends no `limit` must land on the same number.
 */
export const PROPOSAL_PAGE_LIMIT = 24;

/**
 * Free-text proposal title search, shared by every list endpoint's filter.
 * Truncated rather than rejected: an over-long paste is normal in a search
 * field, and the tail past a full title's length could not have matched.
 */
export const proposalSearchSchema = z
  .string()
  .transform((value) => value.slice(0, PROPOSAL_SEARCH_MAX_LENGTH))
  .optional();

/**
 * Response from `decision.listProposalLocations`. Every located proposal in the
 * instance (not just the loaded list page) so the map can plot all pins. Reuses
 * the full `proposalSchema` shape — the heavy fields (documents, counts) are
 * simply left unset — so the map's marker + hovercard render the same
 * `Proposal` type the paginated list produces.
 */
export const proposalLocationsSchema = z.object({
  proposals: z.array(proposalSchema),
});

export type ProposalLocations = z.infer<typeof proposalLocationsSchema>;

/**
 * Input schema for `decision.listAllProposals`. Returns every valid submission
 * regardless of phase scoping, so there are no phase/voting filters. Uses
 * cursor pagination — pass `cursor` from the previous response's `next`.
 */
export const allProposalsFilterSchema = z.object({
  processInstanceId: z.uuid(),
  status: z.enum(ProposalStatus).optional(),
  categoryId: z.string().optional(),
  submittedByProfileId: z.uuid().optional(),
  search: proposalSearchSchema,
  // Restrict to the caller's ballot (self-only); used by the "My ballot" filter.
  votedByProfileId: z.uuid().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  orderBy: z.enum(['createdAt', 'updatedAt']).optional(),
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(PAGE_LIMIT.max).prefault(PAGE_LIMIT.lg),
});

export type AllProposalsFilter = z.infer<typeof allProposalsFilterSchema>;

/** Leaner proposal shape for the read-only "All proposals" tab. */
export const allProposalsListItemSchema = proposalSchema.omit({
  decisionCount: true,
  isEditable: true,
  access: true,
  attachments: true,
  selectionRank: true,
  voteCount: true,
  allocated: true,
});

export type AllProposalsListItem = z.infer<typeof allProposalsListItemSchema>;

/** Response from `decision.listAllProposals`. */
export const allProposalsListSchema = z.object({
  items: z.array(allProposalsListItemSchema),
  // Full count of all matching proposals, independent of cursor pagination.
  total: z.number(),
  next: z.string().nullable(),
});

export type AllProposalsList = z.infer<typeof allProposalsListSchema>;

/** Minimal submitter profile shape used by the face-pile endpoint. */
export const proposalSubmitterSchema = z.object({
  slug: z.string(),
  name: z.string().nullable(),
  avatarImage: z
    .object({
      name: z.string(),
    })
    .nullable(),
});

export type ProposalSubmitter = z.infer<typeof proposalSubmitterSchema>;

// Anonymous-visible `decision.listProposalSubmitters` powers a 20-avatar
// face-pile, so the sample never needs to exceed that. Cap on the server
// (SQL `.limit()`) and re-assert in the wire schema so a regression in either
// place fails loudly instead of streaming thousands of rows to public
// callers (ONE-40 audit #23).
export const PROPOSAL_SUBMITTER_FACE_PILE_MAX = 20;

export const proposalSubmittersListSchema = z.object({
  submitters: z
    .array(proposalSubmitterSchema)
    .max(PROPOSAL_SUBMITTER_FACE_PILE_MAX),
  total: z.number(),
});

export type ProposalSubmittersList = z.infer<
  typeof proposalSubmittersListSchema
>;
