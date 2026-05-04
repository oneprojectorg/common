'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';

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

export const SelectableProposalsTable = ({
  proposals,
  selectedIds,
  onToggle,
  getProposalHref,
}: SelectableProposalsTableProps) => {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const selectedSet = new Set(selectedIds);

  if (isMobile) {
    return (
      <ul className="flex flex-col gap-3" aria-label={t('Eligible proposals')}>
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <SelectableProposalCard
              proposal={proposal}
              isSelected={selectedSet.has(proposal.id)}
              onToggle={onToggle}
              href={getProposalHref?.(proposal)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Table aria-label={t('Eligible proposals')} bleed>
      <TableHeader>
        <TableColumn id="proposal" isRowHeader>
          {t('Proposal')}
        </TableColumn>
        <TableColumn id="budget">{t('Budget')}</TableColumn>
        <TableColumn id="category">{t('Category')}</TableColumn>
        <TableColumn id="select" className="w-32 text-right">
          <span className="sr-only">{t('Select proposal')}</span>
        </TableColumn>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => {
          const isSelected = selectedSet.has(proposal.id);
          const fields = resolvePresentationFields({
            proposal,
            defaultTitle: t('Untitled Proposal'),
          });
          const href = getProposalHref?.(proposal);

          return (
            <TableRow key={proposal.id} id={proposal.id}>
              <TableCell>
                <div className="flex flex-col">
                  {href ? (
                    <Link
                      href={href}
                      className="text-base text-neutral-black hover:underline"
                    >
                      {fields.title}
                    </Link>
                  ) : (
                    <span className="text-base text-neutral-black">
                      {fields.title}
                    </span>
                  )}
                  {fields.submitterName ? (
                    <span className="text-sm text-neutral-gray4">
                      {fields.submitterName}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {fields.budget ? (
                  <span className="text-base text-neutral-black">
                    {fields.budget}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-gray4">—</span>
                )}
              </TableCell>
              <TableCell>
                <SelectionCategoryChips labels={fields.categories} />
              </TableCell>
              <TableCell className="text-right">
                <AdvanceToggleButton
                  isSelected={isSelected}
                  title={fields.title}
                  onPress={() => onToggle(proposal.id)}
                  className="ml-auto"
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
