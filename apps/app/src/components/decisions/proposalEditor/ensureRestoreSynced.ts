import { toast } from '@op/sense/Toast';

import type { TranslateFn } from '@/lib/i18n';

import {
  type SyncedDocProvider,
  type WaitForDocSyncOptions,
  waitForDocSync,
} from '../../collaboration/waitForDocSync';

// How long to wait for TipTap Cloud to acknowledge the reverted content
// before persisting the restored proposal data — updateProposal re-validates
// non-draft proposals against the template, and a stale cloud read surfaces
// false "required" errors for content the revert just restored.
export const RESTORE_SYNC_TIMEOUT_MS = 10_000;

/**
 * Waits for a reverted document to sync to TipTap Cloud, toasting and
 * returning false if it doesn't within `options.timeoutMs`.
 */
export async function ensureRestoreSynced(
  provider: SyncedDocProvider | null | undefined,
  t: TranslateFn,
  options: WaitForDocSyncOptions = { timeoutMs: RESTORE_SYNC_TIMEOUT_MS },
): Promise<boolean> {
  const synced = await waitForDocSync(provider, options);
  if (!synced) {
    toast.error(t('Your changes are still syncing'), {
      description: t('Please wait a moment and try again.'),
    });
  }
  return synced;
}
