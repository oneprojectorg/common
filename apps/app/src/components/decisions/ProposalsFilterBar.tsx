'use client';

import { ProposalFilter } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { LuArrowDownToLine } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { ResponsiveSelect } from './ResponsiveSelect';
import { useProposalFilterItems } from './useProposalFilters';

export const ProposalsListHeader = ({
  hideFilters,
  proposalFilter,
  count,
}: {
  hideFilters: boolean;
  proposalFilter: ProposalFilter;
  count: number;
}) => {
  const t = useTranslations();
  const label = useProposalFilterLabel(proposalFilter);

  if (hideFilters) {
    return (
      <span className="font-serif text-title-base text-neutral-black">
        {t('My proposals')}
      </span>
    );
  }

  // "All proposals" reads as the unfiltered total, so we drop the label and let
  // the count carry the meaning ("328 proposals"). Other filters still need
  // their label since the count alone wouldn't reveal what's been filtered.
  if (proposalFilter === ProposalFilter.ALL) {
    return (
      <span className="font-serif text-title-base text-neutral-black">
        {t('{count, plural, one {# proposal} other {# proposals}}', { count })}
      </span>
    );
  }

  return (
    <span className="font-serif text-title-base text-neutral-black">
      {label} <Bullet /> {count}
    </span>
  );
};

// fallow-ignore-next-line complexity
export const ProposalsFilterBar = ({
  hasVoted,
  currentProfileId,
  proposalFilter,
  setProposalFilter,
  decisionSlug,
  categories,
  selectedCategory,
  onSelectCategory,
  sortOrder,
  onSelectSort,
  canManageProposals,
  isExporting,
  isDownloadReady,
  downloadUrl,
  downloadFileName,
  onExport,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  decisionSlug: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  sortOrder: string;
  onSelectSort: (sort: string) => void;
  canManageProposals: boolean;
  isExporting: boolean;
  isDownloadReady: boolean;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  onExport: () => void;
}) => {
  const t = useTranslations();
  const filterItems = useProposalFilterItems({ hasVoted, currentProfileId });

  // TODO: This is a hardcoded, per-decision copy override — the Columbus
  // decision refers to its categories as "districts", matched here on its
  // decision slug. Replace this with a proper configurable terminology/labeling
  // mechanism (e.g. per-process category term settings) instead of matching on
  // a hardcoded slug so we don't accrue more of these.
  const usesDistricts = decisionSlug === 'columbus';

  return (
    <>
      <ResponsiveSelect
        selectedKey={proposalFilter}
        onSelectionChange={(key) => {
          if (key === ProposalFilter.MY_PROPOSALS && !currentProfileId) {
            return;
          }
          setProposalFilter(key);
        }}
        aria-label={t('Filter proposals')}
        items={filterItems}
      />
      <ResponsiveSelect
        selectedKey={selectedCategory}
        onSelectionChange={onSelectCategory}
        aria-label={
          usesDistricts
            ? t('Filter proposals by district')
            : t('Filter proposals by category')
        }
        items={[
          {
            id: 'all-categories',
            label: usesDistricts ? t('All districts') : t('All categories'),
          },
          ...categories.map((category) => ({
            id: category.id,
            label: category.name,
          })),
        ]}
      />
      <ResponsiveSelect
        selectedKey={sortOrder}
        onSelectionChange={onSelectSort}
        aria-label={t('Sort proposals')}
        className="min-w-32"
        items={[
          { id: 'newest', label: t('Newest First') },
          { id: 'oldest', label: t('Oldest First') },
        ]}
      />
      {canManageProposals ? (
        isDownloadReady && downloadUrl ? (
          <ButtonLink
            href={downloadUrl}
            download={downloadFileName ?? undefined}
            color="secondary"
            size="small"
          >
            <LuArrowDownToLine className="size-4" />
            {t('Click to download')}
          </ButtonLink>
        ) : (
          <Button
            onPress={onExport}
            isDisabled={isExporting}
            color="secondary"
            size="small"
          >
            <LuArrowDownToLine className="size-4" />
            {isExporting ? t('Exporting...') : t('Export')}
          </Button>
        )
      ) : null}
    </>
  );
};

// useTranslations needs literal keys, so map each filter to its label here.
const useProposalFilterLabel = (filter: ProposalFilter) => {
  const t = useTranslations();
  switch (filter) {
    case ProposalFilter.MY_BALLOT:
      return t('My ballot');
    case ProposalFilter.MY_PROPOSALS:
      return t('My proposals');
    case ProposalFilter.SHORTLISTED:
      return t('Shortlisted proposals');
    default:
      return t('All proposals');
  }
};
