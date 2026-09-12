import { getWithStatus, set } from '@op/cache';
import { logger } from '@op/logging';

import type {
  ThemeAnalysisScope,
  ThemeAnalysisSnapshot,
} from '../schemas/themeAnalysis';
import { themeAnalysisSnapshotSchema } from '../schemas/themeAnalysis';
import {
  THEME_ANALYSIS_SNAPSHOT_TTL_SECONDS,
  themeAnalysisSnapshotCacheKey,
} from './constants';

/**
 * How a read of the latest snapshot went.
 *
 * Three outcomes rather than a nullable, for the same reason the run record's
 * reader has three: this is the only copy, and the caller behind the button
 * cannot tell a facilitator "there is nothing to view" when the truth is that
 * Redis did not answer. `unavailable` lets the API throw instead.
 */
export type SnapshotRead =
  | { status: 'hit'; snapshot: ThemeAnalysisSnapshot }
  | { status: 'miss' }
  | { status: 'unavailable' };

/**
 * The most recent finished analysis of a scope, if one has been stored.
 *
 * Parsed on the way out. The snapshot carries the whole result, and a result
 * stored by an older deploy under a shape this one no longer renders should
 * read as "nothing stored" — the next proposal change writes a fresh one — not
 * as a crash in the dialog.
 *
 * @returns The stored snapshot, a miss, or `unavailable` when the cache did not
 *   answer.
 */
export const readLatestThemeAnalysis = async (address: {
  processInstanceId: string;
  scope: ThemeAnalysisScope;
}): Promise<SnapshotRead> => {
  const key = themeAnalysisSnapshotCacheKey(address);
  const read = await getWithStatus(key);

  if (read.status === 'timeout' || read.status === 'error') {
    return { status: 'unavailable' };
  }

  if (read.status !== 'hit') {
    return { status: 'miss' };
  }

  const parsed = themeAnalysisSnapshotSchema.safeParse(read.data);

  if (!parsed.success) {
    logger.warn('Stored theme analysis snapshot failed its schema check', {
      key,
      issues: parsed.error.issues,
    });

    return { status: 'miss' };
  }

  return { status: 'hit', snapshot: parsed.data };
};

/**
 * Stores a finished analysis as the latest for its scope.
 *
 * Overwrites whatever was there. Both the scheduled refresh and a manual run
 * write through this, and the last one to finish wins — which is right, because
 * both read the corpus as it was when they started, and the later start read
 * the later corpus. The corpus digest travels with it so a reader can tell
 * whether the snapshot still describes the proposals it is looking at.
 *
 * Best effort, like the result cache: `set` swallows its own failures, and a
 * dropped write here costs the button a "Find themes" instead of a "View
 * themes" until the next refresh, not the run its result.
 */
export const storeLatestThemeAnalysis = async (
  snapshot: ThemeAnalysisSnapshot,
): Promise<void> => {
  await set(
    themeAnalysisSnapshotCacheKey(snapshot),
    snapshot,
    THEME_ANALYSIS_SNAPSHOT_TTL_SECONDS,
  );
};
