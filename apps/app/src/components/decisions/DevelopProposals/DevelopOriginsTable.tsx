'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';

import { useTranslations } from '@/lib/i18n';

import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { NoOriginsEmpty } from './NoOriginsEmpty';

/**
 * The previous phase's proposals on the develop screen, each with a Prepare
 * action that turns it into an entry of the current phase.
 */
export function DevelopOriginsTable({
  origins,
  onPrepare,
  isPreparing,
  preparingOriginId,
}: {
  origins: Proposal[];
  onPrepare: (origin: Proposal) => void;
  /** An entry is being created or opened; every Prepare waits for it. */
  isPreparing: boolean;
  /** The origin whose entry is being created, which shows the spinner. */
  preparingOriginId: string | null;
}) {
  const t = useTranslations('decisions.develop');

  if (origins.length === 0) {
    return <NoOriginsEmpty />;
  }

  return (
    <Table aria-label={t('originsTableLabel')}>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('proposalColumn')}</TableHead>
          <TableHead scope="col">{t('budgetColumn')}</TableHead>
          <TableHead scope="col" className="w-32">
            <span className="sr-only">{t('actionsColumn')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {origins.map((origin) => {
          const title = origin.profile.name || t('untitledProposal');
          const submitterName = origin.submittedBy?.name ?? null;
          const budget = origin.proposalData.budget;

          return (
            <TableRow key={origin.id}>
              <TableRowHeader>
                <div className="flex flex-col items-start gap-1">
                  <span
                    dir="auto"
                    className="line-clamp-1 text-base text-foreground ltr:text-left rtl:text-right"
                  >
                    {title}
                  </span>
                  {submitterName ? (
                    <span
                      dir="auto"
                      className="line-clamp-1 text-sm text-muted-foreground ltr:text-left rtl:text-right"
                    >
                      {submitterName}
                    </span>
                  ) : null}
                  <SelectionCategoryChips
                    labels={origin.proposalData.category}
                  />
                </div>
              </TableRowHeader>
              <TableCell>
                <span className="text-base">
                  {budget
                    ? formatCurrency(budget.amount, undefined, budget.currency)
                    : '—'}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-28"
                  aria-label={t('prepareEntryLabel', { title })}
                  disabled={isPreparing}
                  loading={preparingOriginId === origin.id}
                  onClick={() => onPrepare(origin)}
                >
                  {t('prepareEntryAction')}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
