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

/**
 * Proposals in launched processes.
 * - `submittedProposals`: the submitted proposals in the processes active in
 *   each period, whenever they were submitted.
 * - `draftProposals`: the drafts in the processes still active at `dataAsOf`.
 */
export const getProposalCounts = async ({
  tx,
  dataAsOf,
  windows,
}: {
  tx: TransactionType;
  dataAsOf: Date;
  windows: PeriodRecord<PeriodWindow>;
}): Promise<{
  submittedProposals: PeriodRecord<number>;
  draftProposals: number;
}> => {
  // Raw SQL: the query builder cannot join the `VALUES` list of period windows.
  const rows = await tx.execute<{
    period: string;
    submitted_proposals: number;
    draft_proposals: number;
  }>(sql`
    with launched as (${launchedProcessesSql(dataAsOf)}),
    proposals as (
      select p.status, launched.is_completed, launched.completed_at
      from decision_proposals p
      join launched on launched.id = p.process_instance_id
      where p.deleted_at is null and p.moderation_detached_at is null
    )
    select
      w.period,
      count(proposals.status) filter (
        where proposals.status <> 'draft'
          and ${isActiveInPeriodSql('proposals')}
      )::int as submitted_proposals,
      (select count(*) from proposals
        where proposals.status = 'draft' and not proposals.is_completed
      )::int as draft_proposals
    from ${periodWindowsSql(windows)}
    left join proposals on true
    group by w.period
  `);

  return {
    submittedProposals: resolvePeriodRows({
      rows,
      resolve: (row) => row.submitted_proposals,
      missing: 0,
    }),
    draftProposals: rows[0]?.draft_proposals ?? 0,
  };
};
