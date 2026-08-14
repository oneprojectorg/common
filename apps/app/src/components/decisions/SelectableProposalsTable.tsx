'use client';

import type { Proposal } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { screens } from '@op/styles/constants';

import { Link, useTranslations } from '@/lib/i18n';

import { AdvanceToggleButton } from './selection/AdvanceToggleButton';
import { SelectionCard } from './selection/SelectionCard';
import { SelectionCategoryChips } from './selection/SelectionCategoryChips';
import { resolvePresentationFields } from './selection/proposalPresentation';

interface SelectableProposalsTableProps {
  proposals: Proposal[];
  selectedIds: string[];
  onToggle: (proposalId: string) => void;
  getProposalHref?: (proposal: Proposal) => string;
  /** Show the per-proposal vote count column. Only used by the final-phase view. */
  showVotes?: boolean;
}

export const SelectableProposalsTable = ({
  proposals,
  selectedIds,
  onToggle,
  getProposalHref,
  showVotes = false,
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
              showVotes={showVotes}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Table aria-label={t('Eligible proposals')} className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>{t('Proposal')}</TableHead>
          <TableHead>{t('Budget')}</TableHead>
          <TableHead>{t('Category')}</TableHead>
          {showVotes ? <TableHead>{t('Votes')}</TableHead> : null}
          <TableHead className="w-32 text-end">
            <span className="sr-only">{t('Select proposal')}</span>
          </TableHead>
        </TableRow>
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
            <TableRow key={proposal.id}>
              <TableCell>
                <div className="flex flex-col">
                  {href ? (
                    <Link
                      href={href}
                      className="text-base text-foreground hover:underline"
                    >
                      <bdi>{fields.title}</bdi>
                    </Link>
                  ) : (
                    <span className="text-base">
                      <bdi>{fields.title}</bdi>
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
                  <span className="text-base">{fields.budget}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <SelectionCategoryChips labels={fields.categories} />
              </TableCell>
              {showVotes ? (
                <TableCell>
                  <span className="text-base">
                    {t('{count} votes', { count: proposal.voteCount ?? 0 })}
                  </span>
                </TableCell>
              ) : null}
              <TableCell className="text-end">
                <AdvanceToggleButton
                  isSelected={isSelected}
                  title={fields.title}
                  onPress={() => onToggle(proposal.id)}
                  className="ms-auto"
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
  showVotes,
}: {
  proposal: Proposal;
  isSelected: boolean;
  onToggle: (proposalId: string) => void;
  href?: string;
  showVotes: boolean;
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
            className="text-base text-foreground hover:underline"
          >
            <bdi>{fields.title}</bdi>
          </Link>
        ) : (
          <span className="text-base">
            <bdi>{fields.title}</bdi>
          </span>
        )}
        {fields.submitterName ? (
          <span className="text-sm text-muted-foreground">
            {fields.submitterName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fields.budget ? (
          <span className="text-base">{fields.budget}</span>
        ) : null}
        <SelectionCategoryChips labels={fields.categories} />
        {showVotes ? (
          <span className="text-sm text-muted-foreground">
            {t('{count} votes', { count: proposal.voteCount ?? 0 })}
          </span>
        ) : null}
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
