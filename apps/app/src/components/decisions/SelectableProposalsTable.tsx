'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/data-table';
import { cn } from '@op/ui/utils';
import { LuCheck } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { resolveProposalSystemFields } from './proposalContentUtils';

interface SelectableProposalsTableProps {
  proposals: Proposal[];
  selectedIds: string[];
  onToggle: (proposalId: string) => void;
  getProposalHref?: (proposal: Proposal) => string;
}

const MAX_VISIBLE_CATEGORIES = 2;

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
            <TableRow
              key={proposal.id}
              id={proposal.id}
              className={
                isSelected
                  ? 'bg-primary-foreground hover:bg-primary-foreground/80'
                  : undefined
              }
            >
              <TableCell>
                <div className="flex flex-col">
                  {href ? (
                    <Link
                      href={href}
                      className="text-base text-foreground hover:underline"
                    >
                      {fields.title}
                    </Link>
                  ) : (
                    <span className="text-base text-foreground">
                      {fields.title}
                    </span>
                  )}
                  {fields.submitterName ? (
                    <span className="text-sm text-muted-foreground">
                      {fields.submitterName}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {fields.budget ? (
                  <span className="text-base text-foreground">
                    {fields.budget}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <CategoryChips
                  categories={fields.visibleCategories}
                  extraCount={fields.extraCategoryCount}
                />
              </TableCell>
              <TableCell className="text-right">
                <ToggleAdvanceButton
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
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        isSelected
          ? 'border-primary bg-primary-foreground'
          : 'border-border bg-white',
      )}
    >
      <div className="flex flex-col gap-1">
        {href ? (
          <Link
            href={href}
            className="text-base text-foreground hover:underline"
          >
            {fields.title}
          </Link>
        ) : (
          <span className="text-base text-foreground">{fields.title}</span>
        )}
        {fields.submitterName ? (
          <span className="text-sm text-muted-foreground">
            {fields.submitterName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fields.budget ? (
          <span className="text-base text-foreground">{fields.budget}</span>
        ) : null}
        <CategoryChips
          categories={fields.visibleCategories}
          extraCount={fields.extraCategoryCount}
        />
      </div>

      <ToggleAdvanceButton
        isSelected={isSelected}
        title={fields.title}
        onPress={() => onToggle(proposal.id)}
        className="w-full"
      />
    </div>
  );
};

const CategoryChips = ({
  categories,
  extraCount,
}: {
  categories: string[];
  extraCount: number;
}) => {
  const t = useTranslations();

  if (categories.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {categories.map((category) => (
        <Chip key={category}>{category}</Chip>
      ))}
      {extraCount > 0 ? (
        <span className="text-xs text-muted-foreground">
          {t('+{count} More', { count: extraCount })}
        </span>
      ) : null}
    </div>
  );
};

const ToggleAdvanceButton = ({
  isSelected,
  title,
  onPress,
  className,
}: {
  isSelected: boolean;
  title: string;
  onPress: () => void;
  className?: string;
}) => {
  const t = useTranslations();

  return (
    <Button
      size="small"
      color={isSelected ? 'verified' : 'secondary'}
      onPress={onPress}
      aria-label={
        isSelected
          ? t("Don't advance {title}", { title })
          : t('Advance {title}', { title })
      }
      className={cn('relative', className)}
    >
      <span className="invisible flex items-center gap-1">
        <LuCheck className="size-4" />
        {t('Advancing')}
      </span>
      <span className="absolute inset-0 flex items-center justify-center gap-1">
        {isSelected ? (
          <>
            <LuCheck className="size-4" />
            {t('Advancing')}
          </>
        ) : (
          t('Advance')
        )}
      </span>
    </Button>
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
  const visibleCategories = categories.slice(0, MAX_VISIBLE_CATEGORIES);
  const extraCategoryCount = categories.length - visibleCategories.length;
  const title = resolvedTitle || proposal.profile.name || defaultTitle;
  const submitterName = proposal.submittedBy?.name;
  const formattedBudget = budget?.amount
    ? formatCurrency(budget.amount, undefined, budget.currency)
    : null;

  return {
    title,
    submitterName,
    budget: formattedBudget,
    visibleCategories,
    extraCategoryCount,
  };
};
