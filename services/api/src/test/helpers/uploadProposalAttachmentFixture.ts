import { createServerClient } from '@op/supabase/lib';
import { Buffer } from 'node:buffer';

import type { appRouter } from '../../routers';

type Caller = ReturnType<typeof appRouter.createCaller>;

export const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function createStorageAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookieOptions: {},
      cookies: {
        getAll: async () => [],
        setAll: async () => {},
      },
    },
  );
}

export async function uploadProposalAttachmentFixture(
  caller: Caller,
  args: { proposalId: string; fileName: string; mimeType?: string },
) {
  const mimeType = args.mimeType ?? 'image/png';
  const fileSize = VALID_PNG_BUFFER.length;

  const { path } = await caller.decision.createProposalAttachmentUploadUrl({
    proposalId: args.proposalId,
    fileName: args.fileName,
    mimeType,
    fileSize,
  });

  const supabase = createStorageAdmin();
  const { error } = await supabase.storage
    .from('assets')
    .upload(path, VALID_PNG_BUFFER, { contentType: mimeType, upsert: true });

  if (error) {
    throw error;
  }

  return caller.decision.uploadProposalAttachment({
    proposalId: args.proposalId,
    path,
    fileName: args.fileName,
    mimeType,
    fileSize,
  });
}
