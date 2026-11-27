import { type TransactionType, sql } from '@op/db/client';

import {
  isActiveInPeriodSql,
  launchedProcessesSql,
  periodWindowsSql,
} from './dashboardSql';
import {
  type PeriodRecord,
  type PeriodWindow,
  resolvePeriodRows,
} from './utils';

export const getProcessCounts = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{
  totalProcesses: number;
  totalCompletedProcesses: number;
  activeProcesses: number;
  newProcesses: PeriodRecord<number>;
  completedProcesses: PeriodRecord<number>;
  activeProcessesInPeriod: PeriodRecord<number>;
}> => {
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    new_processes: number;
    completed_processes: number;
    active_processes_in_period: number;
    total_processes: number;
    total_completed_processes: number;
    active_processes: number;
  }>(sql`
    with launched as (${launchedProcessesSql(dataAsOf)})
    select
      w.period,
      count(launched.id) filter (where launched.launched_at >= w.starts_at)::int
        as new_processes,
      count(launched.id) filter (where launched.completed_at >= w.starts_at)::int
        as completed_processes,
      count(launched.id) filter (where ${isActiveInPeriodSql('launched')})::int
        as active_processes_in_period,
      (select count(*) from launched)::int as total_processes,
      (select count(*) from launched where launched.is_completed)::int
        as total_completed_processes,
      (select count(*) from launched where not launched.is_completed)::int
        as active_processes
    from ${periodWindowsSql(windows)}
    left join launched on true
    group by w.period
  `);

  return {
    totalProcesses: rows[0]?.total_processes ?? 0,
    totalCompletedProcesses: rows[0]?.total_completed_processes ?? 0,
    activeProcesses: rows[0]?.active_processes ?? 0,
    newProcesses: resolvePeriodRows({
      rows,
      resolve: (row) => row.new_processes,
      missing: 0,
    }),
    completedProcesses: resolvePeriodRows({
      rows,
      resolve: (row) => row.completed_processes,
      missing: 0,
    }),
    activeProcessesInPeriod: resolvePeriodRows({
      rows,
      resolve: (row) => row.active_processes_in_period,
      missing: 0,
    }),
  };
};
