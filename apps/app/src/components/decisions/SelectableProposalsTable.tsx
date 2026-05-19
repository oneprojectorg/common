'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { type ColumnDef, DataTable } from '@op/ui-next/DataTable';
import { useMemo } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import { resolveProposalSystemFields } from './proposalContentUtils';
import { AdvanceToggleButton } from './selection/AdvanceToggleButton';
import { SelectionCard } from './selection/SelectionCard';
import { SelectionCategoryChips } from './selection/SelectionCategoryChips';

interface SelectableProposalsTableProps {
  proposals: Proposal[];
  selectedIds: string[];
  onToggle: (proposalId: string) => void;
  getProposalHref?: (proposal: Proposal) => string;
}

interface ProposalRow {
  proposal: Proposal;
  title: string;
  submitterName?: string;
  budget: string | null;
  categories: string[];
  href?: string;
}

export const SelectableProposalsTable = ({
  proposals,
  selectedIds,
  onToggle,
  getProposalHref,
}: SelectableProposalsTableProps) => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const rows = useMemo<ProposalRow[]>(
    () =>
      proposals.map((proposal) => {
        const fields = resolvePresentationFields({
          proposal,
          defaultTitle: t('Untitled Proposal'),
        });
        return {
          proposal,
          ...fields,
          href: getProposalHref?.(proposal),
        };
      }),
    [proposals, t, getProposalHref],
  );

  const columns = useMemo<ColumnDef<ProposalRow, unknown>[]>(
    () => [
      {
        id: 'proposal',
        header: t('Proposal'),
        cell: ({ row }) => {
          const { title, submitterName, href } = row.original;
          return (
            <div className="flex flex-col">
              {href ? (
                <Link
                  href={href}
                  className="text-base text-neutral-black hover:underline"
                >
                  {title}
                </Link>
              ) : (
                <span className="text-base text-neutral-black">{title}</span>
              )}
              {submitterName ? (
                <span className="text-sm text-neutral-gray4">
                  {submitterName}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'budget',
        header: t('Budget'),
        cell: ({ row }) =>
          row.original.budget ? (
            <span className="text-base text-neutral-black">
              {row.original.budget}
            </span>
          ) : (
            <span className="text-sm text-neutral-gray4">—</span>
          ),
      },
      {
        id: 'category',
        header: t('Category'),
        cell: ({ row }) => (
          <SelectionCategoryChips labels={row.original.categories} />
        ),
      },
      {
        id: 'select',
        header: () => <span className="sr-only">{t('Select proposal')}</span>,
        cell: ({ row }) => {
          const { proposal, title } = row.original;
          const isSelected = selectedSet.has(proposal.id);
          return (
            <div className="flex justify-end">
              <AdvanceToggleButton
                isSelected={isSelected}
                title={title}
                onPress={() => onToggle(proposal.id)}
                className="ml-auto"
              />
            </div>
          );
        },
      },
    ],
    [t, onToggle, selectedSet],
  );

  if (isMobile) {
    return (
      <ul className="flex flex-col gap-3" aria-label={t('Eligible proposals')}>
        {rows.map((row) => (
          <li key={row.proposal.id}>
            <SelectableProposalCard
              proposal={row.proposal}
              isSelected={selectedSet.has(row.proposal.id)}
              onToggle={onToggle}
              href={row.href}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DataTable
      aria-label={t('Eligible proposals')}
      columns={columns}
      data={rows}
      getRowId={(row) => row.proposal.id}
    />
  );
};

const SelectableProposalCard = ({
  proposal,
  isSelected,
  onToggle,
  href,
}: {
  proposal: Proposal;
  isSelected: boolean;
  onToggle: (proposalId: string) => void;
  href?: string;
}) => {
  const t = useTranslations();
  const fields = resolvePresentationFields({
    proposal,
    defaultTitle: t('Untitled Proposal'),
  });

  return (
    <SelectionCard isSelected={isSelected}>
      <div className="flex flex-col gap-1">
        {href ? (
          <Link
            href={href}
            className="text-base text-neutral-black hover:underline"
          >
            {fields.title}
          </Link>
        ) : (
          <span className="text-base text-neutral-black">{fields.title}</span>
        )}
        {fields.submitterName ? (
          <span className="text-sm text-neutral-gray4">
            {fields.submitterName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fields.budget ? (
          <span className="text-base text-neutral-black">{fields.budget}</span>
        ) : null}
        <SelectionCategoryChips labels={fields.categories} />
      </div>

      <AdvanceToggleButton
        isSelected={isSelected}
        title={fields.title}
        onPress={() => onToggle(proposal.id)}
        className="w-full"
      />
    </SelectionCard>
  );
};

const resolvePresentationFields = ({
  proposal,
  defaultTitle,
}: {
  proposal: Proposal;
  defaultTitle: string;
}) => {
  const {
    title: resolvedTitle,
    budget,
    category: categories = [],
  } = resolveProposalSystemFields(proposal);
  const title = resolvedTitle || proposal.profile.name || defaultTitle;
  const submitterName = proposal.submittedBy?.name;
  const formattedBudget = budget?.amount
    ? formatCurrency(budget.amount, undefined, budget.currency)
    : null;

  return {
    title,
    submitterName,
    budget: formattedBudget,
    categories,
  };
};
