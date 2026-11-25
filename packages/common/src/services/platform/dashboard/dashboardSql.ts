import { GLOBAL_USER_IDS, allowedEmailDomains } from '@op/core';
import { aliasedTable, sql } from '@op/db/client';
import {
  authUsers,
  decisionProcessResults,
  decisionProcessTransitions,
  processInstances,
  processPhases,
  profileInvites,
  profiles,
  stateTransitionHistory,
  users,
} from '@op/db/schema';
import type { SQL } from 'drizzle-orm';

import { DASHBOARD_PERIODS, TEST_EMAIL_DOMAINS } from './constants';
import type { PeriodRecord, PeriodWindow } from './utils';

const user = aliasedTable(users, 'u');
const authUser = aliasedTable(authUsers, 'au');
const instance = aliasedTable(processInstances, 'i');
const transition = aliasedTable(decisionProcessTransitions, 't');
const invite = aliasedTable(profileInvites, 'pi');
const history = aliasedTable(stateTransitionHistory, 'h');
const phase = aliasedTable(processPhases, 'p');
const phaseProfile = aliasedTable(profiles, 'pr');
const result = aliasedTable(decisionProcessResults, 'r');

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
  select ${user.authUserId}, ${user.createdAt}
  from ${users} ${user}
  join ${authUsers} ${authUser} on ${authUser.id} = ${user.authUserId}
  where ${user.deletedAt} is null
    and ${user.authUserId} not in (${sql.join(
      GLOBAL_USER_IDS.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    and ${authUser.isAnonymous} is not true
    and (${authUser.emailConfirmedAt} is not null or ${authUser.phoneConfirmedAt} is not null)
    and lower(split_part(coalesce(${authUser.email}, ${user.email}, ''), '@', 2))
      not in (${sqlList([...allowedEmailDomains, ...TEST_EMAIL_DOMAINS])})
    and ${user.createdAt} <= ${timestampSql(dataAsOf)}
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
const isRealProcessSql = sql`${instance.name} !~* '(test|example)'`;

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
      ${instance.id},
      ${instance.currentStateId},
      ${instance.updatedAt},
      coalesce(
        least(
          (select min(${transition.createdAt}) from ${decisionProcessTransitions} ${transition}
            where ${transition.processInstanceId} = ${instance.id} and ${transition.deletedAt} is null),
          (select min(${invite.notifiedAt}) from ${profileInvites} ${invite}
            where ${invite.profileId} = ${instance.profileId} and ${invite.deletedAt} is null),
          (select min(${history.transitionedAt}) from ${stateTransitionHistory} ${history}
            where ${history.processInstanceId} = ${instance.id})
        ),
        ${instance.createdAt}
      ) as launched_at,
      coalesce(last_phase.phase_id, ${instance.instanceData} -> 'phases' -> -1 ->> 'phaseId')
        as last_phase_id,
      last_phase.row_id as last_phase_row_id,
      ${configuredDateSql(
        sql`case when last_phase.row_id is null
          then ${instance.instanceData} -> 'phases' -> -1 ->> 'startDate'
          else last_phase.start_date end`,
      )} as last_phase_start_date
    from ${processInstances} ${instance}
    left join lateral (
      select
        ${phase.id}::text as row_id,
        coalesce(${phase.data} ->> 'phaseId', ${phaseProfile.slug}) as phase_id,
        ${phase.data} ->> 'startDate' as start_date
      from ${processPhases} ${phase}
      join ${profiles} ${phaseProfile} on ${phaseProfile.id} = ${phase.profileId}
      where ${phase.processInstanceId} = ${instance.id} and ${phase.deletedAt} is null
      order by ${phase.sortOrder} desc
      limit 1
    ) last_phase on true
    where ${instance.deletedAt} is null
      and ${instance.status} in ('published', 'completed')
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
      (select max(${history.transitionedAt}) from ${stateTransitionHistory} ${history}
        where ${history.processInstanceId} = classified.id
          and ${history.toStateId} in (classified.last_phase_id, classified.last_phase_row_id)),
      classified.last_phase_start_date,
      (select max(${result.executedAt}) from ${decisionProcessResults} ${result}
        where ${result.processInstanceId} = classified.id and ${result.deletedAt} is null),
      classified.updated_at
    ), ${timestampSql(dataAsOf)}) end as completed_at
  from classified
`;
