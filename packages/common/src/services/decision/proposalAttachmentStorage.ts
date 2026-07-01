// Shared constants and helpers for the proposal-attachment upload flow.
// The bucket and path prefix here are the source of truth for both
// `signProposalAttachmentUploadUrl` (which signs a write URL) and
// `uploadProposalAttachment` (which records the upload).

import { DEFAULT_UPLOAD_SIZE_LIMIT } from '../../utils/storage';

export const PROPOSAL_ATTACHMENT_BUCKET = 'assets';

export const proposalAttachmentPathPrefix = (profileId: string) =>
  `profile/${profileId}/proposals/`;

export const MAX_PROPOSAL_ATTACHMENT_FILE_SIZE = DEFAULT_UPLOAD_SIZE_LIMIT;

// Accepted MIME types for proposal attachments. Overlaps with (but diverges
// from) `ALLOWED_RESOURCE_MIME_TYPES` — proposals allow `video/mp4` while
// resources allow `application/…presentationml.presentation`. Kept as a
// per-feature list rather than a shared base + extras so the full accepted
// set is readable at a glance.
export const ALLOWED_PROPOSAL_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4',
] as const;

export type AllowedProposalAttachmentMimeType =
  (typeof ALLOWED_PROPOSAL_ATTACHMENT_MIME_TYPES)[number];

export const isAllowedProposalAttachmentMimeType = (
  mimeType: string,
): mimeType is AllowedProposalAttachmentMimeType =>
  (ALLOWED_PROPOSAL_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    mimeType,
  );
