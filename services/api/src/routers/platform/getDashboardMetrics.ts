import { getDashboardMetrics } from '@op/common';
import { dashboardMetricsSchema } from '@op/common/client';
import { z } from 'zod';

import { withAuthenticatedStaff } from '../../middlewares/withAuthenticatedStaff';
import withRateLimited from '../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../trpcFactory';

export const getDashboardMetricsRouter = router({
  getDashboardMetrics: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedStaff)
    .input(z.void())
    .output(dashboardMetricsSchema)
    .query(async () => {
      return getDashboardMetrics();
    }),
});
