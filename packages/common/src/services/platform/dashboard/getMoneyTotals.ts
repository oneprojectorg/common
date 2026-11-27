import { type TransactionType, aliasedTable, sql } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  processInstances,
  processPhases,
  profiles,
  proposals,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { SQL } from 'drizzle-orm';

import {
  EXPECTED_CURRENCY,
  MAX_COUNTED_AMOUNT,
  MAX_LOGGED_PROCESS_INSTANCE_IDS,
  MAX_REPORTED_CURRENCIES,
  OTHER_CURRENCY,
} from './constants';
import {
  isActiveInPeriodSql,
  launchedProcessesSql,
  periodWindowsSql,
  timestampSql,
} from './dashboardSql';
import {
  type MoneyTotal,
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
 * Money in launched processes, in `EXPECTED_CURRENCY`.
 * - `moneyMoved`: the funded amounts of the selections of completed processes,
 *   with the selections whose proposal budget names another currency.
 * - `activeProcessBudgets`: the budgets of the processes active in each period.
 *   A phase budget is a plain number with no currency.
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
  moneyMoved: MoneyTotal;
  activeProcessBudgets: PeriodRecord<number>;
}> => {
  // A failed run also writes a result row, and a re-run writes another, so
  // only the newest successful run counts. Its total is the one
  // `getResultsStats` shows: `allocated`, or else the proposal's budget.
  // `allocated` has no currency of its own, so it takes the proposal's.
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    active_process_budgets: number;
    money_moved: number;
    unexpected_amount_count: number;
    unexpected_process_count: number;
    unexpected_currencies: string[] | null;
    unexpected_process_instance_ids: string[] | null;
  }>(sql`
    with launched as (${launchedProcessesSql(dataAsOf)}),
    latest_results as (
      select distinct on (${result.processInstanceId})
        ${result.id}, ${result.processInstanceId}
      from ${decisionProcessResults} ${result}
      join launched on launched.id = ${result.processInstanceId}
      where launched.is_completed
        and ${result.success}
        and ${result.deletedAt} is null
        and ${result.executedAt} <= ${timestampSql(dataAsOf)}
      order by ${result.processInstanceId}, ${result.executedAt} desc, ${result.id} desc
    ),
    moved_selections as (
      select
        latest_results.process_instance_id,
        coalesce(
          ${countedAmountSql(sql`${selection.allocated}`)},
          ${proposalBudgetAmountSql(sql`${proposal.proposalData} -> 'budget'`)},
          0
        ) as amount,
        ${unexpectedCurrencySql(sql`${proposal.proposalData} -> 'budget'`)} as unexpected_currency
      from latest_results
      join ${decisionProcessResultSelections} ${selection}
        on ${selection.processResultId} = latest_results.id
      join ${proposals} ${proposal} on ${proposal.id} = ${selection.proposalId}
    ),
    money_moved as (
      select
        coalesce(sum(amount), 0)::float8 as money_moved,
        count(*) filter (where unexpected_currency is not null)::int
          as unexpected_amount_count,
        count(distinct process_instance_id) filter (
          where unexpected_currency is not null
        )::int as unexpected_process_count,
        (array_agg(distinct unexpected_currency order by unexpected_currency)
          filter (where unexpected_currency is not null)
        )[1:${MAX_REPORTED_CURRENCIES}::int] as unexpected_currencies,
        (array_agg(distinct process_instance_id::text order by process_instance_id::text)
          filter (where unexpected_currency is not null)
        )[1:${MAX_LOGGED_PROCESS_INSTANCE_IDS}::int] as unexpected_process_instance_ids
      from moved_selections
    ),
    budgeted as (${processBudgetsSql}),
    period_budgets as (
      select
        w.period,
        coalesce(sum(budgeted.budget) filter (
          where ${isActiveInPeriodSql('budgeted')}
        ), 0)::float8 as active_process_budgets
      from ${periodWindowsSql(windows)}
      left join budgeted on true
      group by w.period
    )
    select period_budgets.period, period_budgets.active_process_budgets, money_moved.*
    from period_budgets
    cross join money_moved
  `);

  // Every row carries the same single `money_moved` aggregate.
  const moved = rows[0];
  const moneyMoved: MoneyTotal = {
    amount: moved?.money_moved ?? 0,
    unexpectedAmountCount: moved?.unexpected_amount_count ?? 0,
    unexpectedProcessCount: moved?.unexpected_process_count ?? 0,
    unexpectedCurrencies: moved?.unexpected_currencies ?? [],
  };

  if (moneyMoved.unexpectedAmountCount > 0) {
    logger.warn(
      'Dashboard money figure has amounts in an unexpected currency',
      {
        figure: 'moneyMoved',
        amountCount: moneyMoved.unexpectedAmountCount,
        processInstanceIds: moved?.unexpected_process_instance_ids ?? [],
        currencies: moneyMoved.unexpectedCurrencies,
      },
    );
  }

  return {
    moneyMoved,
    activeProcessBudgets: resolvePeriodRows({
      rows,
      resolve: (row) => row.active_process_budgets,
      missing: 0,
    }),
  };
};

// The currency of a proposal budget `{ amount, currency }`, trimmed and in
// upper case, when it is set and is not `EXPECTED_CURRENCY`. Otherwise null.
// It reaches the page and the logs, so anything but a three-letter code is
// reported as `OTHER_CURRENCY`.
const unexpectedCurrencySql = (budget: SQL): SQL => sql`case
  when jsonb_typeof(${budget} -> 'currency') = 'string'
    and upper(btrim(${budget} ->> 'currency')) not in ('', ${EXPECTED_CURRENCY})
  then case
    when upper(btrim(${budget} ->> 'currency')) ~ '^[A-Z]{3}$'
    then upper(btrim(${budget} ->> 'currency'))
    else ${OTHER_CURRENCY}
  end
end`;

// A numeric amount, or null when it is beyond `MAX_COUNTED_AMOUNT`.
const countedAmountSql = (amount: SQL): SQL => sql`case
  when abs(${amount}) <= ${MAX_COUNTED_AMOUNT}::numeric then ${amount}
end`;

// SQL does not promise to evaluate `and` operands in order, so each cast sits
// in the `then` of a `case` whose condition makes it valid.
const numberAmountSql = (value: SQL): SQL =>
  sql`case when jsonb_typeof(${value}) = 'number' then ${countedAmountSql(sql`(${value})::numeric`)} end`;

// The shapes `extractBudgetValue` reads: a number, a numeric string, or
// `{ amount, currency }`. Anything else is null.
const proposalBudgetAmountSql = (
  budget: SQL,
): SQL => sql`case jsonb_typeof(${budget})
  when 'number' then ${countedAmountSql(sql`(${budget})::numeric`)}
  when 'string' then case
    when (${budget} #>> '{}')
      ~ '^[[:space:]]*[+-]?([0-9]{1,100}([.][0-9]{0,100})?|[.][0-9]{1,100})([eE][+-]?[0-9]{1,3})?[[:space:]]*$'
    then ${countedAmountSql(sql`(${budget} #>> '{}')::numeric`)}
  end
  when 'object' then case
    when jsonb_typeof(${budget} -> 'amount') = 'number'
      and jsonb_typeof(${budget} -> 'currency') = 'string'
    then ${countedAmountSql(sql`(${budget} -> 'amount')::numeric`)}
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
