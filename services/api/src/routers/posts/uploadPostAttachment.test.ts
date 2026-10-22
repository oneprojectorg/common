import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createGatingCallers } from '../../test/helpers/gating/callers';
import { supabaseTestAdminClient } from '../../test/supabase-utils';

describeAccessTierGating('posts.uploadPostAttachment', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.posts.uploadPostAttachment({
          file: 'x',
          fileName: 'x',
          mimeType: 'x',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.posts.uploadPostAttachment({
          file: 'x',
          fileName: 'x',
          mimeType: 'x',
        }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.posts.uploadPostAttachment({
          file: 'x',
          fileName: 'x',
          mimeType: 'x',
        }),
      );
    },
  ),
});

// 1x1 transparent PNG.
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe.concurrent('posts.uploadPostAttachment', () => {
  // The rich-text editor writes this URL straight into the stored document
  // (`setImage({ src: url })`), so anything expiring here breaks the image a
  // day later on every page that renders the document.
  it('returns a durable public URL, not an expiring signed one', async ({
    onTestFinished,
  }) => {
    const caller = await createGatingCallers(onTestFinished).networkJwt();

    const result = await caller.posts.uploadPostAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'overview photo.png',
      mimeType: 'image/png',
    });

    onTestFinished(async () => {
      await supabaseTestAdminClient.storage
        .from('assets')
        .remove([result.path]);
    });

    expect(result.url).toBe(`/assets/${result.path}`);
    expect(result.url).not.toContain('token=');
  });
});
