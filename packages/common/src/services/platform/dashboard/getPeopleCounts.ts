import { type TransactionType, sql } from '@op/db/client';

import {
  eligibleUsersSql,
  isActiveInPeriodSql,
  launchedProcessesSql,
  periodWindowsSql,
} from './dashboardSql';
import {
  type PeriodRecord,
  type PeriodWindow,
  resolvePeriodRows,
} from './utils';

/**
 * Counts of eligible users.
 * - `activeUsers`: users who signed in or used a session in each period.
 *   Every period ends at `dataAsOf`, so that is a latest activity on or after
 *   the period start.
 * - `participatingUsers`: active users who are members, in any role, of a
 *   process active in each period.
 */
export const getPeopleCounts = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{
  totalUsers: number;
  newUsers: PeriodRecord<number>;
  activeUsers: PeriodRecord<number>;
  participatingUsers: PeriodRecord<number>;
}> => {
  // A returning visitor refreshes a session without a new sign-in.
  // `auth.sessions.refreshed_at` holds UTC without a time zone.
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    new_users: number;
    active_users: number;
    participating_users: number;
    total_users: number;
  }>(sql`
    with eligible_users as (${eligibleUsersSql(dataAsOf)}),
    active_users as (
      select
        eligible_users.auth_user_id,
        greatest(au.last_sign_in_at, sessions.last_seen_at) as last_active_at
      from eligible_users
      join auth.users au on au.id = eligible_users.auth_user_id
      left join lateral (
        select max(greatest(
          s.refreshed_at at time zone 'UTC',
          s.updated_at,
          s.created_at
        )) as last_seen_at
        from auth.sessions s
        where s.user_id = eligible_users.auth_user_id
      ) sessions on true
    ),
    launched as (${launchedProcessesSql(dataAsOf)}),
    process_members as (
      select pu.auth_user_id, launched.is_completed, launched.completed_at
      from launched
      join decision_process_instances i on i.id = launched.id
      join profile_users pu
        on pu.profile_id = i.profile_id and pu.deleted_at is null
    )
    select
      w.period,
      (select count(*) from eligible_users
        where eligible_users.created_at >= w.starts_at
      )::int as new_users,
      (select count(*) from active_users
        where active_users.last_active_at >= w.starts_at
      )::int as active_users,
      (select count(*) from active_users
        where active_users.last_active_at >= w.starts_at
          and exists (
            select 1 from process_members
            where process_members.auth_user_id = active_users.auth_user_id
              and ${isActiveInPeriodSql('process_members')}
          )
      )::int as participating_users,
      (select count(*) from eligible_users)::int as total_users
    from ${periodWindowsSql(windows)}
  `);

  return {
    totalUsers: rows[0]?.total_users ?? 0,
    newUsers: resolvePeriodRows({
      rows,
      resolve: (row) => row.new_users,
      missing: 0,
    }),
    activeUsers: resolvePeriodRows({
      rows,
      resolve: (row) => row.active_users,
      missing: 0,
    }),
    participatingUsers: resolvePeriodRows({
      rows,
      resolve: (row) => row.participating_users,
      missing: 0,
    }),
  };
};
