import { z } from 'zod';

import { proposalDataSchema } from '../proposalDataSchema';

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

/** Base profile shape as embedded in proposals. */
export const proposalProfileSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  bio: z.string().nullable(),
  mission: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  headerImage: storageItemSchema.nullish(),
  avatarImage: storageItemSchema.nullish(),
  individual: z.object({ pronouns: z.string().nullable() }).nullish(),
});

export type ProposalProfile = z.infer<typeof proposalProfileSchema>;

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
  uploader: proposalProfileSchema.optional(),
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
  submittedBy: proposalProfileSchema.optional(),
  profile: proposalProfileSchema,
  decisionCount: z.number().optional(),
  likesCount: z.number().optional(),
  followersCount: z.number().optional(),
  commentsCount: z.number().optional(),
  isLikedByUser: z.boolean().optional(),
  isFollowedByUser: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  access: proposalAccessSchema.optional(),
  attachments: z.array(proposalAttachmentSchema).optional(),
  selectionRank: z.number().nullable().optional(),
  voteCount: z.number().optional(),
  allocated: z.string().nullable().optional(),
  proposalTemplate: z.record(z.string(), z.unknown()).nullable().optional(),
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
});

export type ProposalList = z.infer<typeof proposalListSchema>;

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

export const proposalSubmittersListSchema = z.object({
  submitters: z.array(proposalSubmitterSchema),
});

export type ProposalSubmittersList = z.infer<
  typeof proposalSubmittersListSchema
>;
