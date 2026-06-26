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

  return (
    <span className="font-serif text-title-base text-neutral-black">
      {hideFilters ? (
        t('My proposals')
      ) : (
        <>
          {label} <Bullet /> {count}
        </>
      )}
    </span>
  );
};

// fallow-ignore-next-line complexity
export const ProposalsFilterBar = ({
  hasVoted,
  currentProfileId,
  proposalFilter,
  setProposalFilter,
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

  return (
    <div className="flex min-w-0 items-center gap-4 overflow-x-auto [&>*]:shrink-0">
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
        aria-label={t('Filter proposals by category')}
        items={[
          { id: 'all-categories', label: t('All categories') },
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
    </div>
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
