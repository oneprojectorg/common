import { db } from '@op/db/client';

import { getFeedbackCounts } from './getFeedbackCounts';
import { getGrowthCounts } from './getGrowthCounts';
import { getMoneyTotals } from './getMoneyTotals';
import { getPeopleCounts } from './getPeopleCounts';
import { getProcessCounts } from './getProcessCounts';
import { getProposalCounts } from './getProposalCounts';
import type { DashboardMetrics } from './schemas';
import { resolveDashboardMetrics, resolvePeriodWindows } from './utils';

/**
 * The platform-metrics snapshot. Every period comes from one computation with
 * one `dataAsOf`, so switching the period never refetches.
 */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
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
