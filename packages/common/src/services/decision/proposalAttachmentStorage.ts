// Proposal-attachment upload flow: path prefix + size cap. Bucket, sanitizer,
// MIME allowlist, and the shared upload-boundary check live in
// `utils/storage.ts` so this feature and the resources upload flow stay in
// lockstep.

import { DEFAULT_UPLOAD_SIZE_LIMIT } from '../../utils/storage';

export const proposalAttachmentPathPrefix = (profileId: string) =>
  `profile/${profileId}/proposals/`;

export const MAX_PROPOSAL_ATTACHMENT_FILE_SIZE = DEFAULT_UPLOAD_SIZE_LIMIT;
