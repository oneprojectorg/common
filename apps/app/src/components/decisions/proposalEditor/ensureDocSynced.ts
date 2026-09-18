import { toast } from '@op/sense/Toast';

import type { TranslateFn } from '@/lib/i18n';

import {
  type SyncedDocProvider,
  type WaitForDocSyncOptions,
  waitForDocSync,
} from '../../collaboration/waitForDocSync';

export const DOC_SYNC_TIMEOUT_MS = 10_000;

export async function ensureDocSynced(
  provider: SyncedDocProvider | null | undefined,
  hasSyncedOnce: boolean,
  t: TranslateFn,
  options: WaitForDocSyncOptions = { timeoutMs: DOC_SYNC_TIMEOUT_MS },
): Promise<boolean> {
  if (!hasSyncedOnce) {
    return true;
  }

  const synced = await waitForDocSync(provider, options);
  if (!synced) {
    toast.error(t('Your changes are still syncing'), {
      description: t('Please wait a moment and try again.'),
    });
  }
  return synced;
}
