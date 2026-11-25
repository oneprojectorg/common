import { type TransactionType, sql } from '@op/db/client';

import {
  launchedProcessesSql,
  periodWindowsSql,
  timestampSql,
} from './dashboardSql';
import {
  type PeriodRecord,
  type PeriodWindow,
  type SurveyCounts,
  resolvePeriodRows,
} from './utils';

/** Exit-survey counts for the processes completed in each period. */
export const getFeedbackCounts = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{ netPromoterScore: PeriodRecord<SurveyCounts> }> => {
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    response_count: number;
    promoter_count: number;
    detractor_count: number;
    process_count: number;
  }>(sql`
    with launched as (${launchedProcessesSql(dataAsOf)}),
    scores as (
      select
        r.process_instance_id,
        case when jsonb_typeof(r.internal_data -> 'npsScore') = 'number'
          then (r.internal_data ->> 'npsScore')::numeric end as score
      from decision_process_survey_responses r
      where r.deleted_at is null
        and r.created_at <= ${timestampSql(dataAsOf)}
    ),
    valid_scores as (
      select * from scores where score between 0 and 10
    )
    select
      w.period,
      count(valid_scores.score)::int as response_count,
      count(valid_scores.score) filter (where valid_scores.score >= 9)::int
        as promoter_count,
      count(valid_scores.score) filter (where valid_scores.score <= 6)::int
        as detractor_count,
      count(distinct valid_scores.process_instance_id)::int as process_count
    from ${periodWindowsSql(windows)}
    left join launched
      on launched.is_completed and launched.completed_at >= w.starts_at
    left join valid_scores on valid_scores.process_instance_id = launched.id
    group by w.period
  `);

  return {
    netPromoterScore: resolvePeriodRows({
      rows,
      resolve: (row) => ({
        responseCount: row.response_count,
        promoterCount: row.promoter_count,
        detractorCount: row.detractor_count,
        processCount: row.process_count,
      }),
      missing: {
        responseCount: 0,
        promoterCount: 0,
        detractorCount: 0,
        processCount: 0,
      },
    }),
  };
};
