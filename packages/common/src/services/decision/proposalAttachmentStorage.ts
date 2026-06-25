// Shared constants and helpers for the proposal-attachment upload flow.
// The bucket and path prefix here are the source of truth for both
// `signProposalAttachmentUploadUrl` (which signs a write URL) and
// `uploadProposalAttachment` (which records the upload).

export const PROPOSAL_ATTACHMENT_BUCKET = 'assets';

export const proposalAttachmentPathPrefix = (profileId: string) =>
  `profile/${profileId}/proposals/`;

// File names are user-supplied; sanitize to ASCII before placing in the
// storage key. Matches the conservative ruleset used by the resources
// upload flow.
export const sanitizeProposalAttachmentFileName = (raw: string): string => {
  const base = raw.split(/[/\\]/).pop() ?? raw;
  return base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 255);
};

export const MAX_PROPOSAL_ATTACHMENT_FILE_SIZE = 25 * 1024 * 1024;

// Image MIME types accepted on proposal attachments. Both the client picker
// and the server record endpoint pull from this list so the two layers
// can't drift — and so iOS Safari's auto-conversion from HEIC to JPEG is
// the path users hit, not "unsupported type".
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
