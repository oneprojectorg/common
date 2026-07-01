// Shared constants and helpers for the proposal-attachment upload flow.
// The bucket and path prefix here are the source of truth for both
// `signProposalAttachmentUploadUrl` (which signs a write URL) and
// `uploadProposalAttachment` (which records the upload). Size cap and
// accepted MIME types come from the workspace-wide upload defaults in
// `utils/storage.ts` so features don't drift.

import { DEFAULT_UPLOAD_SIZE_LIMIT } from '../../utils/storage';

export const PROPOSAL_ATTACHMENT_BUCKET = 'assets';

export const proposalAttachmentPathPrefix = (profileId: string) =>
  `profile/${profileId}/proposals/`;

export const MAX_PROPOSAL_ATTACHMENT_FILE_SIZE = DEFAULT_UPLOAD_SIZE_LIMIT;
