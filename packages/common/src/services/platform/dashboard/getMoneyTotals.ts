import { type TransactionType, sql } from '@op/db/client';
import type { SQL } from 'drizzle-orm';

import {
  isActiveInPeriodSql,
  launchedProcessesSql,
  periodWindowsSql,
  timestampSql,
} from './dashboardSql';
import {
  type PeriodRecord,
  type PeriodWindow,
  resolvePeriodRows,
} from './utils';

/**
 * Money in launched processes. Every stored amount is USD.
 * - `moneyMoved`: the funded amounts of the selections of completed processes.
 * - `activeProcessBudgets`: the budgets of the processes active in each period.
 */
export const getMoneyTotals = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{
  moneyMoved: number;
  activeProcessBudgets: PeriodRecord<number>;
}> => {
  // A failed run also writes a result row, and a re-run writes another, so
  // only the newest successful run counts. Its total is the one
  // `getResultsStats` shows: `allocated`, or else the proposal's budget.
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    active_process_budgets: number;
    money_moved: number;
  }>(sql`
    with launched as (${launchedProcessesSql(dataAsOf)}),
    latest_results as (
      select distinct on (r.process_instance_id) r.id
      from decision_process_results r
      join launched on launched.id = r.process_instance_id
      where launched.is_completed
        and r.success
        and r.deleted_at is null
        and r.executed_at <= ${timestampSql(dataAsOf)}
      order by r.process_instance_id, r.executed_at desc, r.id desc
    ),
    budgeted as (${processBudgetsSql})
    select
      w.period,
      coalesce(sum(budgeted.budget) filter (
        where ${isActiveInPeriodSql('budgeted')}
      ), 0)::float8 as active_process_budgets,
      (select coalesce(sum(coalesce(
          s.allocated,
          ${proposalBudgetAmountSql(sql`p.proposal_data -> 'budget'`)},
          0
        )), 0)
        from latest_results
        join decision_process_result_selections s
          on s.process_result_id = latest_results.id
        join decision_proposals p on p.id = s.proposal_id
      )::float8 as money_moved
    from ${periodWindowsSql(windows)}
    left join budgeted on true
    group by w.period
  `);

  return {
    moneyMoved: rows[0]?.money_moved ?? 0,
    activeProcessBudgets: resolvePeriodRows({
      rows,
      resolve: (row) => row.active_process_budgets,
      missing: 0,
    }),
  };
};

// SQL does not promise to evaluate `and` operands in order, so each cast sits
// in the `then` of a `case` whose condition makes it valid.
const numberAmountSql = (value: SQL): SQL =>
  sql`case when jsonb_typeof(${value}) = 'number' then (${value})::numeric end`;

// The shapes `extractBudgetValue` reads: a number, a numeric string, or
// `{ amount, currency }`. Anything else is null.
const proposalBudgetAmountSql = (
  budget: SQL,
): SQL => sql`case jsonb_typeof(${budget})
  when 'number' then (${budget})::numeric
  when 'string' then case
    when (${budget} #>> '{}')
      ~ '^[[:space:]]*[+-]?([0-9]{1,100}([.][0-9]{0,100})?|[.][0-9]{1,100})([eE][+-]?[0-9]{1,3})?[[:space:]]*$'
    then (${budget} #>> '{}')::numeric
  end
  when 'object' then case
    when jsonb_typeof(${budget} -> 'amount') = 'number'
      and jsonb_typeof(${budget} -> 'currency') = 'string'
    then (${budget} -> 'amount')::numeric
  end
end`;

// The budget of each launched process (in a `launched` CTE), picked like
// `getProcessBudget`: the current phase's budget, or else the first phase
// with one. The legacy `instance_data.phases` copy is read only for an
// instance without live phase rows, because phase edits do not update it.
const processBudgetsSql: SQL = sql`
  select
    launched.is_completed,
    launched.completed_at,
    coalesce(phase_row.budget, legacy_phase.budget) as budget
  from launched
  join decision_process_instances i on i.id = launched.id
  left join lateral (
    select ${numberAmountSql(sql`p.data -> 'settings' -> 'budget'`)} as budget
    from decision_process_phases p
    join profiles pr on pr.id = p.profile_id
    where p.process_instance_id = i.id
      and p.deleted_at is null
      and ${numberAmountSql(sql`p.data -> 'settings' -> 'budget'`)} > 0
    order by
      coalesce(i.current_state_id in (coalesce(p.data ->> 'phaseId', pr.slug), p.id::text), false) desc,
      p.sort_order
    limit 1
  ) phase_row on true
  left join lateral (
    select ${numberAmountSql(sql`phase.value -> 'settings' -> 'budget'`)} as budget
    from jsonb_array_elements(
      case when jsonb_typeof(i.instance_data -> 'phases') = 'array'
        then i.instance_data -> 'phases' else '[]'::jsonb end
    ) with ordinality as phase(value, position)
    where ${numberAmountSql(sql`phase.value -> 'settings' -> 'budget'`)} > 0
      and not exists (
        select 1 from decision_process_phases live_phase
        where live_phase.process_instance_id = i.id
          and live_phase.deleted_at is null
      )
    order by
      coalesce(phase.value ->> 'phaseId' = i.current_state_id, false) desc,
      phase.position
    limit 1
  ) legacy_phase on true
`;
