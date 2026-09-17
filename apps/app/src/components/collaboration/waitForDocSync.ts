export type SyncedDocProvider = {
  readonly synced: boolean;
  readonly hasUnsyncedChanges: boolean;
};

export interface WaitForDocSyncOptions {
  timeoutMs?: number;
  pollMs?: number;
}

export function isDocSynced(
  provider: SyncedDocProvider | null | undefined,
): boolean {
  return !provider || (provider.synced && !provider.hasUnsyncedChanges);
}

export async function waitForDocSync(
  provider: SyncedDocProvider | null | undefined,
  { timeoutMs = 10_000, pollMs = 100 }: WaitForDocSyncOptions = {},
): Promise<boolean> {
  if (isDocSynced(provider)) {
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    if (isDocSynced(provider)) {
      return true;
    }
  }

  return isDocSynced(provider);
}
