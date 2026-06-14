import type {
  ModerationItemType,
  ModerationMediaItem,
  ModerationProvider,
} from './types';

export interface ReviewContentAsyncInput {
  itemType: ModerationItemType;
  itemId: string;
  /**
   * Identifies this submission round. Must be stable across retries of the
   * same logical submission (the Inngest wiring memoizes it per event) so a
   * verdict that landed before a retry isn't orphaned by a new round id.
   */
  roundId: string;
  content: string;
  /** Already-resolved, publicly-fetchable media (signed before this call). */
  media?: ModerationMediaItem[];
  /** Where the provider should POST its verdict. */
  callbackUrl: string;
}

export interface ReviewContentAsyncDeps {
  provider: ModerationProvider | null;
  /**
   * Persists the round of tasks about to be submitted (one per ref) so the
   * per-task webhook verdicts can be aggregated. Receives the refs verbatim;
   * the wiring maps them to submission rows.
   */
  recordRound: (
    itemType: ModerationItemType,
    itemId: string,
    roundId: string,
    submittedRefs: string[],
  ) => Promise<void>;
}

/**
 * Async moderation pass that runs after content is written. It records the
 * round of tasks the submission fans out into, then *submits* the content
 * (text + media) to the provider; the verdict for each task arrives later via
 * the provider's webhook, which is where a flag is actually created. The round
 * is written before the submit so a verdict can never arrive for an unrecorded
 * task — verdicts for unknown tasks are dropped. No flag is written here.
 * Decoupled from Inngest/DB via injected deps so the submit flow is
 * unit-testable; the Inngest function wires the real provider + store and
 * resolves media first.
 */
export const reviewContentAsync = async (
  {
    itemType,
    itemId,
    roundId,
    content,
    media,
    callbackUrl,
  }: ReviewContentAsyncInput,
  { provider, recordRound }: ReviewContentAsyncDeps,
): Promise<{ submitted: boolean; providerRecordId?: string }> => {
  // No provider, or a provider without the async capability (sync-gate only):
  // nothing to submit. `planReviewRefs` is required so the round can be
  // recorded ahead of the submit.
  if (!provider?.submitForReview || !provider.planReviewRefs) {
    return { submitted: false };
  }

  const planned = provider.planReviewRefs({
    itemType,
    itemId,
    roundId,
    content,
    media,
  });
  if (planned.length === 0) {
    return { submitted: false };
  }

  await recordRound(itemType, itemId, roundId, planned);

  const reference = await provider.submitForReview({
    itemType,
    itemId,
    roundId,
    content,
    media,
    callbackUrl,
  });

  return { submitted: true, providerRecordId: reference.providerRecordId };
};
