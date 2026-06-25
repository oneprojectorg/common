import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { CommonError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import {
  PROPOSAL_ATTACHMENT_BUCKET,
  proposalAttachmentPathPrefix,
  sanitizeProposalAttachmentFileName,
} from './proposalAttachmentStorage';

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

  const sanitized = sanitizeProposalAttachmentFileName(input.fileName);
  const storagePath = `${proposalAttachmentPathPrefix(profileId)}${Date.now()}_${sanitized}`;

  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(PROPOSAL_ATTACHMENT_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data?.signedUrl || !data?.token) {
    throw new CommonError(error?.message ?? 'Could not sign upload URL');
  }

  return {
    storagePath: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}
