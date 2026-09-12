import { getWithStatus, set } from '@op/cache';
import { logger } from '@op/logging';

import type { ThemeAnalysisResult } from '../schemas/themeAnalysis';
import { themeAnalysisResultSchema } from '../schemas/themeAnalysis';
import {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  themeAnalysisResultCacheKey,
} from './constants';

/**
 * Where a result was stored and read back by, so the two never disagree on the
 * key.
 */
interface ResultCacheAddress {
  processInstanceId: string;
  /** See `fingerprintCorpus`. */
  fingerprint: string;
}

/**
 * A finished analysis of exactly this corpus, if one has been stored.
 *
 * Absence and unavailability both read as null here, unlike the run record's
 * reads. There the record is the only copy and a cache that did not answer must
 * not be reported as "no such run"; here the cache is an optimisation in front
 * of two model passes that can always be run again, so the honest answer to
 * "did Redis not answer" is the same as the answer to "it held nothing" — do the
 * work.
 *
 * Parsed against the result schema on the way out, for the same reason the run
 * record is: the cache holds whatever was written, and a result stored by an
 * older deploy under a shape this one no longer renders is a re-run, not a
 * crash in the dialog.
 *
 * @param address - The instance and corpus digest the result was computed
 *   over.
 * @returns The stored result, or null when the passes have to run.
 */
export const readCachedThemeAnalysisResult = async (
  address: ResultCacheAddress,
): Promise<ThemeAnalysisResult | null> => {
  const key = themeAnalysisResultCacheKey(address);
  const read = await getWithStatus(key);

  if (read.status !== 'hit') {
    return null;
  }

  const parsed = themeAnalysisResultSchema.safeParse(read.data);

  if (!parsed.success) {
    // Worth a line: a stored result that no longer parses is a shape change
    // nobody accounted for, and it silently costs every reader a re-run.
    logger.warn('Cached theme analysis result failed its schema check', {
      key,
      issues: parsed.error.issues,
    });

    return null;
  }

  return parsed.data;
};

/**
 * Stores a finished analysis under the digest of the corpus it was computed
 * over, so the next request for the same text can skip the model.
 *
 * Best effort. `set` reports nothing and swallows its own failures, and that is
 * the right contract here: the run's record is already written by the time this
 * is called, so a dropped write costs the next facilitator a re-run rather than
 * costing this one their result. Failing the step over it would retry a
 * completed analysis's terminal write for the sake of an optimisation.
 *
 * @param address - The instance and corpus digest to store under.
 * @param result - The grounded analysis, as written to the run's record.
 */
export const storeCachedThemeAnalysisResult = async (
  address: ResultCacheAddress,
  result: ThemeAnalysisResult,
): Promise<void> => {
  await set(
    themeAnalysisResultCacheKey(address),
    result,
    THEME_ANALYSIS_CACHE_TTL_SECONDS,
  );
};
