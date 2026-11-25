import { cache, invalidate } from '@op/cache';
import { db } from '@op/db/client';

import {
  DASHBOARD_METRICS_CACHE_TTL_MS,
  DASHBOARD_METRICS_CACHE_VERSION,
} from './constants';
import { getFeedbackCounts } from './getFeedbackCounts';
import { getGrowthCounts } from './getGrowthCounts';
import { getMoneyTotals } from './getMoneyTotals';
import { getPeopleCounts } from './getPeopleCounts';
import { getProcessCounts } from './getProcessCounts';
import { getProposalCounts } from './getProposalCounts';
import { type DashboardMetrics, dashboardMetricsSchema } from './schemas';
import { resolveDashboardMetrics, resolvePeriodWindows } from './utils';

/**
 * The platform-metrics snapshot. Every period comes from one computation with
 * one `dataAsOf`, so switching the period never refetches.
 */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  // Outside production, seed scripts and data checks need fresh numbers.
  if (process.env.NODE_ENV !== 'production') {
    return getLiveDashboardMetrics();
  }

  const params = ['dashboardMetrics', DASHBOARD_METRICS_CACHE_VERSION];
  const cached: unknown = await cache<DashboardMetrics>({
    type: 'platform',
    params,
    fetch: getLiveDashboardMetrics,
    options: { ttl: DASHBOARD_METRICS_CACHE_TTL_MS },
  });

  const parsed = dashboardMetricsSchema.safeParse(cached);
  if (parsed.success) {
    return parsed.data;
  }

  const metrics = await getLiveDashboardMetrics();
  await invalidate({ type: 'platform', params, data: metrics });

  return metrics;
};

const getLiveDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const dataAsOf = new Date();
  const windows = resolvePeriodWindows(dataAsOf);

  // One repeatable-read transaction gives every section the same snapshot
  // and holds one pool connection, so the sections run one after another.
  const sections = await db.transaction(
    async (tx) => {
      const args = { tx, dataAsOf, windows };

      return {
        people: await getPeopleCounts(args),
        growth: await getGrowthCounts(args),
        processes: await getProcessCounts(args),
        proposals: await getProposalCounts(args),
        money: await getMoneyTotals(args),
        feedback: await getFeedbackCounts(args),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );

  return resolveDashboardMetrics({ dataAsOf, ...sections });
};
