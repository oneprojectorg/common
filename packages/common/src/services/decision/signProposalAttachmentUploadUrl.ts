import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError } from '../../utils';
import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';
import { ASSETS_BUCKET } from '../../utils/storage';
import { getCurrentProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import { proposalAttachmentPathPrefix } from './proposalAttachmentStorage';

export interface SignProposalAttachmentUploadUrlInput {
  proposalId: string;
  fileName: string;
}

export interface SignProposalAttachmentUploadUrlResult {
  storagePath: string;
  signedUrl: string;
  token: string;
}

/**
 * Issues a Supabase signed upload URL the client can PUT a file to directly.
 * The follow-up `uploadProposalAttachment` call records the attachment once
 * the upload completes. Using a signed URL avoids round-tripping the file
 * through our tRPC body (which a 25MB iPhone photo blows past once base64
 * encoded), and lets the proposal flow handle the same file sizes resources
 * already does.
 */
export async function signProposalAttachmentUploadUrl({
  input,
  user,
}: {
  input: SignProposalAttachmentUploadUrlInput;
  user: User;
}): Promise<SignProposalAttachmentUploadUrlResult> {
  const [profileId, proposal] = await Promise.all([
    getCurrentProfileId(user.id),
    db.query.proposals.findFirst({
      where: { id: input.proposalId },
    }),
  ]);

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: proposal.profileId,
    permissions: { profile: permission.UPDATE },
  });

  return signStorageUploadUrl({
    bucket: ASSETS_BUCKET,
    pathPrefix: proposalAttachmentPathPrefix(profileId),
    fileName: input.fileName,
  });
}
