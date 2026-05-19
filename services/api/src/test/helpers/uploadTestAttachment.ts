import { Buffer } from 'node:buffer';

import { supabaseTestAdminClient } from '../supabase-utils';

/**
 * Uploads a base64-encoded file to the assets bucket using the admin client
 * (bypasses RLS). Mirrors the client-side direct-upload path: the binary
 * lands in storage independently of the tRPC handler, then tests pass the
 * resulting `path` to `uploadProposalAttachment`.
 */
export async function uploadTestAttachmentToStorage({
  base64,
  fileName,
  mimeType,
}: {
  base64: string;
  fileName: string;
  mimeType: string;
}): Promise<{ path: string; fileSize: number }> {
  if (!supabaseTestAdminClient) {
    throw new Error('Supabase admin client not initialized');
  }

  const buffer = Buffer.from(base64, 'base64');
  const path = `test/${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName}`;

  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Test storage upload failed: ${error.message}`);
  }

  return { path, fileSize: buffer.length };
}
