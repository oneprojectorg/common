import { type TransactionType, aliasedTable, sql } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  processInstances,
  processPhases,
  profiles,
  proposals,
} from '@op/db/schema';
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

const result = aliasedTable(decisionProcessResults, 'r');
const selection = aliasedTable(decisionProcessResultSelections, 's');
const proposal = aliasedTable(proposals, 'p');
const instance = aliasedTable(processInstances, 'i');
const phase = aliasedTable(processPhases, 'p');
const phaseProfile = aliasedTable(profiles, 'pr');
const livePhase = aliasedTable(processPhases, 'live_phase');

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
      select distinct on (${result.processInstanceId}) ${result.id}
      from ${decisionProcessResults} ${result}
      join launched on launched.id = ${result.processInstanceId}
      where launched.is_completed
        and ${result.success}
        and ${result.deletedAt} is null
        and ${result.executedAt} <= ${timestampSql(dataAsOf)}
      order by ${result.processInstanceId}, ${result.executedAt} desc, ${result.id} desc
    ),
    budgeted as (${processBudgetsSql})
    select
      w.period,
      coalesce(sum(budgeted.budget) filter (
        where ${isActiveInPeriodSql('budgeted')}
      ), 0)::float8 as active_process_budgets,
      (select coalesce(sum(coalesce(
          ${selection.allocated},
          ${proposalBudgetAmountSql(sql`${proposal.proposalData} -> 'budget'`)},
          0
        )), 0)
        from latest_results
        join ${decisionProcessResultSelections} ${selection}
          on ${selection.processResultId} = latest_results.id
        join ${proposals} ${proposal} on ${proposal.id} = ${selection.proposalId}
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
  join ${processInstances} ${instance} on ${instance.id} = launched.id
  left join lateral (
    select ${numberAmountSql(sql`${phase.data} -> 'settings' -> 'budget'`)} as budget
    from ${processPhases} ${phase}
    join ${profiles} ${phaseProfile} on ${phaseProfile.id} = ${phase.profileId}
    where ${phase.processInstanceId} = ${instance.id}
      and ${phase.deletedAt} is null
      and ${numberAmountSql(sql`${phase.data} -> 'settings' -> 'budget'`)} > 0
    order by
      coalesce(${instance.currentStateId} in (coalesce(${phase.data} ->> 'phaseId', ${phaseProfile.slug}), ${phase.id}::text), false) desc,
      ${phase.sortOrder}
    limit 1
  ) phase_row on true
  left join lateral (
    select ${numberAmountSql(sql`phase.value -> 'settings' -> 'budget'`)} as budget
    from jsonb_array_elements(
      case when jsonb_typeof(${instance.instanceData} -> 'phases') = 'array'
        then ${instance.instanceData} -> 'phases' else '[]'::jsonb end
    ) with ordinality as phase(value, position)
    where ${numberAmountSql(sql`phase.value -> 'settings' -> 'budget'`)} > 0
      and not exists (
        select 1 from ${processPhases} ${livePhase}
        where ${livePhase.processInstanceId} = ${instance.id}
          and ${livePhase.deletedAt} is null
      )
    order by
      coalesce(phase.value ->> 'phaseId' = ${instance.currentStateId}, false) desc,
      phase.position
    limit 1
  ) legacy_phase on true
`;
