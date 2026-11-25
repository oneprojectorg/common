import { type TransactionType, aliasedTable, sql } from '@op/db/client';
import { organizations } from '@op/db/schema';

import { periodWindowsSql, timestampSql } from './dashboardSql';
import {
  type PeriodRecord,
  type PeriodWindow,
  resolvePeriodRows,
} from './utils';

const organization = aliasedTable(organizations, 'o');

export const getGrowthCounts = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{
  totalOrganizations: number;
  newOrganizations: PeriodRecord<number>;
}> => {
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    new_organizations: number;
    total_organizations: number;
  }>(sql`
    with live_organizations as (
      select ${organization.createdAt}
      from ${organizations} ${organization}
      where ${organization.deletedAt} is null
        and ${organization.createdAt} <= ${timestampSql(dataAsOf)}
    )
    select
      w.period,
      count(live_organizations.created_at)::int as new_organizations,
      (select count(*) from live_organizations)::int as total_organizations
    from ${periodWindowsSql(windows)}
    left join live_organizations on live_organizations.created_at >= w.starts_at
    group by w.period
  `);

  return {
    totalOrganizations: rows[0]?.total_organizations ?? 0,
    newOrganizations: resolvePeriodRows({
      rows,
      resolve: (row) => row.new_organizations,
      missing: 0,
    }),
  };
};
