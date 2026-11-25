import { GLOBAL_USER_IDS, allowedEmailDomains } from '@op/core';
import { sql } from '@op/db/client';
import type { SQL } from 'drizzle-orm';

import { DASHBOARD_PERIODS, TEST_EMAIL_DOMAINS } from './constants';
import type { PeriodRecord, PeriodWindow } from './utils';

const sqlList = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

export const timestampSql = (date: Date): SQL =>
  sql`${date.toISOString()}::timestamptz`;

/** One `(period, starts_at)` row per dashboard period, aliased `w`. */
export const periodWindowsSql = (windows: PeriodRecord<PeriodWindow>): SQL =>
  sql`(values ${sql.join(
    DASHBOARD_PERIODS.map(
      (period) =>
        sql`(${period}::text, ${timestampSql(windows[period].start)})`,
    ),
    sql`, `,
  )}) as w(period, starts_at)`;

/**
 * The `auth_user_id` and `created_at` of every real person's account at
 * `dataAsOf`. Leaves out deleted, anonymous and unconfirmed accounts, the
 * access-control sentinels, internal OP accounts and seeded test accounts. A
 * login-code request creates the account before the code is confirmed.
 */
export const eligibleUsersSql = (dataAsOf: Date): SQL => sql`
  select u.auth_user_id, u.created_at
  from users u
  join auth.users au on au.id = u.auth_user_id
  where u.deleted_at is null
    and u.auth_user_id not in (${sql.join(
      GLOBAL_USER_IDS.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    and au.is_anonymous is not true
    and (au.email_confirmed_at is not null or au.phone_confirmed_at is not null)
    and lower(split_part(coalesce(au.email, u.email, ''), '@', 2))
      not in (${sqlList([...allowedEmailDomains, ...TEST_EMAIL_DOMAINS])})
    and u.created_at <= ${timestampSql(dataAsOf)}
`;

/**
 * Whether the launched process in the `process` row (with `is_completed` and
 * `completed_at`) was active in the period of the `w` row. Every launched
 * process started on or before the period end (`dataAsOf`), so it was active
 * unless it completed before the period start.
 */
export const isActiveInPeriodSql = (process: string): SQL => {
  const row = sql.identifier(process);

  return sql`(not ${row}.is_completed or ${row}.completed_at >= w.starts_at)`;
};

/** Staff name their trial processes with "test" or "example". */
const isRealProcessSql = sql`i.name !~* '(test|example)'`;

// A malformed stored date must not fail the whole snapshot: only the date part
// of an ISO value is read, and an impossible day (Feb 30) gives null.
const configuredDateSql = (value: SQL): SQL => sql`(
  select case
    when extract(month from make_date(parts[1]::int, parts[2]::int, 1) + (parts[3]::int - 1))
      = parts[2]::int
    then make_date(parts[1]::int, parts[2]::int, parts[3]::int)::timestamp at time zone 'UTC'
  end
  from regexp_match(
    ${value},
    '^([1-9][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
  ) as date_match(parts)
)`;

/**
 * Every launched (published or completed), non-test process at `dataAsOf`,
 * with `launched_at` (estimated: no column stores the launch), `is_completed`
 * (the current phase is the last phase) and `completed_at`.
 */
export const launchedProcessesSql = (dataAsOf: Date): SQL => sql`
  with instances as (
    select
      i.id,
      i.current_state_id,
      i.updated_at,
      coalesce(
        least(
          (select min(t.created_at) from decision_process_transitions t
            where t.process_instance_id = i.id and t.deleted_at is null),
          (select min(pi.notified_at) from profile_invites pi
            where pi.profile_id = i.profile_id and pi.deleted_at is null),
          (select min(h.transitioned_at) from decision_transition_history h
            where h.process_instance_id = i.id)
        ),
        i.created_at
      ) as launched_at,
      coalesce(last_phase.phase_id, i.instance_data -> 'phases' -> -1 ->> 'phaseId')
        as last_phase_id,
      last_phase.row_id as last_phase_row_id,
      ${configuredDateSql(
        sql`case when last_phase.row_id is null
          then i.instance_data -> 'phases' -> -1 ->> 'startDate'
          else last_phase.start_date end`,
      )} as last_phase_start_date
    from decision_process_instances i
    left join lateral (
      select
        p.id::text as row_id,
        coalesce(p.data ->> 'phaseId', pr.slug) as phase_id,
        p.data ->> 'startDate' as start_date
      from decision_process_phases p
      join profiles pr on pr.id = p.profile_id
      where p.process_instance_id = i.id and p.deleted_at is null
      order by p.sort_order desc
      limit 1
    ) last_phase on true
    where i.deleted_at is null
      and i.status in ('published', 'completed')
      and ${isRealProcessSql}
  ),
  classified as (
    select
      instances.*,
      coalesce(
        current_state_id = last_phase_id or current_state_id = last_phase_row_id,
        false
      ) as is_completed
    from instances
    where launched_at <= ${timestampSql(dataAsOf)}
  )
  select
    classified.id,
    classified.launched_at,
    classified.is_completed,
    case when classified.is_completed then least(coalesce(
      (select max(h.transitioned_at) from decision_transition_history h
        where h.process_instance_id = classified.id
          and h.to_state_id in (classified.last_phase_id, classified.last_phase_row_id)),
      classified.last_phase_start_date,
      (select max(r.executed_at) from decision_process_results r
        where r.process_instance_id = classified.id and r.deleted_at is null),
      classified.updated_at
    ), ${timestampSql(dataAsOf)}) end as completed_at
  from classified
`;
