'use client';

import { formatCurrency } from '@/utils/formatting';
import { ProposalStatus } from '@op/api/encoders';
import type { OwnDevelopedProposal } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Header3 } from '@op/sense/Header';
import { StatusBadge } from '@op/sense/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { LuFileText } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { SearchField } from '@/components/SearchField';

/**
 * The caller's own entries of the current phase, drafts and ready ones: title
 * and origins, category, budget and status, with the title linking into the
 * entry. The list is the caller's whole set, never paginated, so the search
 * filters it in place.
 */
export function DevelopEntriesTable({
  entries,
  editHref,
}: {
  entries: OwnDevelopedProposal[];
  /** Where an entry opens. */
  editHref: (entry: OwnDevelopedProposal) => string;
}) {
  const t = useTranslations('decisions.develop');
  const locale = useLocale();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLocaleLowerCase(locale);
  const shown = needle
    ? entries.filter((entry) =>
        [
          entry.title,
          ...entry.category,
          ...entry.origins.map((origin) => origin.name),
        ]
          .join(' ')
          .toLocaleLowerCase(locale)
          .includes(needle),
      )
    : entries;
  const showCategory = entries.some((entry) => entry.category.length > 0);
  const total = getBudgetTotal(entries);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-live="polite">
          <Header3>
            {total
              ? t('entriesCountWithBudget', {
                  count: entries.length,
                  budget: formatCurrency(total.amount, locale, total.currency),
                })
              : t('entriesCount', { count: entries.length })}
          </Header3>
        </div>
        {entries.length > 0 ? (
          <SearchField
            value={query}
            onChange={setQuery}
            label={t('searchEntriesLabel')}
          />
        ) : null}
      </div>

      <div aria-live="polite">
        {shown.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuFileText className="size-6" />
              </EmptyMedia>
              <EmptyTitle render={<h4 />}>
                {entries.length > 0
                  ? t('noMatchingEntriesTitle')
                  : t('noEntriesTitle')}
              </EmptyTitle>
              <EmptyDescription>
                {entries.length > 0
                  ? t('noMatchingEntriesDescription')
                  : t('noEntriesDescription')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table aria-label={t('entriesTableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('entryColumn')}</TableHead>
                {showCategory ? (
                  <TableHead scope="col">{t('categoryColumn')}</TableHead>
                ) : null}
                <TableHead scope="col">{t('budgetColumn')}</TableHead>
                <TableHead scope="col">{t('statusColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  href={editHref(entry)}
                  showCategory={showCategory}
                  locale={locale}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  href,
  showCategory,
  locale,
}: {
  entry: OwnDevelopedProposal;
  href: string;
  showCategory: boolean;
  locale: string;
}) {
  const t = useTranslations('decisions.develop');
  const isDraft = entry.status === ProposalStatus.DRAFT;
  const originNames = entry.origins.map((origin) => origin.name).join(', ');

  return (
    <TableRow>
      <TableRowHeader className="py-4">
        <div className="flex flex-col items-start gap-1">
          <Link
            href={href}
            dir="auto"
            className="line-clamp-1 text-base text-foreground ltr:text-left rtl:text-right"
          >
            {entry.title || t('untitledEntry')}
          </Link>
          {originNames ? (
            <span className="text-sm text-muted-foreground">
              {t.rich('entryOrigins', {
                origins: originNames,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </span>
          ) : null}
        </div>
      </TableRowHeader>
      {showCategory ? (
        <TableCell className="py-4">
          <bdi>{entry.category.join(', ')}</bdi>
        </TableCell>
      ) : null}
      <TableCell className="py-4 tabular-nums">
        {entry.budget && entry.budget.amount > 0
          ? formatCurrency(entry.budget.amount, locale, entry.budget.currency)
          : '—'}
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge variant={isDraft ? 'in-progress' : 'success'} icon={false}>
          {isDraft ? t('entryDraftStatus') : t('entryReadyStatus')}
        </StatusBadge>
      </TableCell>
    </TableRow>
  );
}

/** The entries' budget total, or null when there is none or currencies differ. */
function getBudgetTotal(
  entries: OwnDevelopedProposal[],
): { amount: number; currency: string } | null {
  const budgets = entries.flatMap((entry) =>
    entry.budget && entry.budget.amount > 0 ? [entry.budget] : [],
  );
  const currency = budgets[0]?.currency;

  if (!currency || budgets.some((budget) => budget.currency !== currency)) {
    return null;
  }

  return {
    amount: budgets.reduce((sum, budget) => sum + budget.amount, 0),
    currency,
  };
}
