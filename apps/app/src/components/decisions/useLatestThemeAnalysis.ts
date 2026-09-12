'use client';

import { trpc } from '@op/api/client';
import type {
  ThemeAnalysisScope,
  ThemeAnalysisSnapshot,
} from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { useEffect } from 'react';

export interface LatestThemeAnalysis {
  /** The stored analysis, or null when there is none to view. */
  snapshot: ThemeAnalysisSnapshot | null;
  /** The first read has not landed, so "none to view" is not yet known. */
  isLoading: boolean;
}

/**
 * Reads the most recent stored theme analysis of a scope.
 *
 * This is what decides whether the control says "View themes" or "Find themes".
 * The scheduled refresh writes a snapshot whenever the instance's proposals
 * change, so for a live decision there is usually one; the manual run is the
 * fallback for an instance nothing has touched since the feature shipped.
 *
 * Not a suspense query, deliberately. The control sits in the filter bar
 * beside the list, and suspending it would hold that bar on a read whose only
 * effect is a label. A read that fails is logged and treated as "nothing
 * stored": the facilitator still gets the button that runs an analysis, which
 * is the same control they had before snapshots existed.
 *
 * The query registers the scope's latest-analysis channel, and both writers
 * broadcast on it after storing, so the label flips without a reload when the
 * refresh lands.
 */
export const useLatestThemeAnalysis = (
  processInstanceId: string,
  scope: ThemeAnalysisScope,
): LatestThemeAnalysis => {
  const { data, error, isLoading } =
    trpc.decision.getLatestThemeAnalysis.useQuery(
      { processInstanceId, scope },
      {
        // The provider disables retries globally. One dropped request should
        // not demote a stored analysis to "run it again".
        retry: 2,
      },
    );

  useEffect(() => {
    if (error) {
      logger.error('Could not read the latest theme analysis', { error });
    }
  }, [error]);

  return {
    snapshot: data?.status === 'ready' ? data : null,
    isLoading,
  };
};
