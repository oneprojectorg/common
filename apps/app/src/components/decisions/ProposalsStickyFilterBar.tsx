'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { useIntersectionObserver } from '@op/hooks';
import { cn } from '@op/ui/utils';

import { type ProposalView, ProposalViewToggle } from './ProposalViewToggle';
import { ProposalsFilterBar, ProposalsListHeader } from './ProposalsFilterBar';

export interface ProposalsStickyFilterBarProps {
  isMapMode: boolean;
  hideFilters: boolean;
  /** Full server-side proposal count for the active filter. */
  total: number;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  hasVoted: boolean;
  currentProfileId: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  sortOrder: string;
  setSortOrder: (value: string) => void;
  canManageProposals: boolean;
  isExporting: boolean;
  isDownloadReady: boolean;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  onExport: () => void;
  hasLocationField: boolean;
  effectiveView: ProposalView;
  onViewChange: (next: ProposalView) => void;
}

// Filters bar — sticks beneath the decision nav while the list/map scroll under
// it. Owns its own stuck-detection so the full-bleed top/bottom border lines can
// fade in only once pinned.
export const ProposalsStickyFilterBar = ({
  isMapMode,
  hideFilters,
  total,
  proposalFilter,
  setProposalFilter,
  hasVoted,
  currentProfileId,
  categories,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
  canManageProposals,
  isExporting,
  isDownloadReady,
  downloadUrl,
  downloadFileName,
  onExport,
  hasLocationField,
  effectiveView,
  onViewChange,
}: ProposalsStickyFilterBarProps) => {
  // The filter bar pins at top-14 (56px). A zero-height sentinel at its natural
  // top is observed against the viewport shrunk by that offset; once the
  // sentinel scrolls past it the bar is pinned. initialIsIntersecting avoids a
  // one-frame "stuck" flash on mount. Drives the full-width borders via the
  // data-stuck attribute on the bar below.
  const { ref: filterSentinelRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
      rootMargin: '-56px 0px 0px 0px',
      initialIsIntersecting: true,
    });
  const isFilterBarStuck = !isIntersecting;

  return (
    <>
      {/* Sentinel at the filter bar's pre-pin top — drives the JS "stuck"
          detection that toggles data-stuck on the bar below. */}
      <div
        ref={filterSentinelRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
      />
      {/* Filters Bar — sticks beneath the decision nav while the list/map
          scroll under it. Only once pinned, full-bleed top/bottom lines fade
          in via the before/after pseudo-elements (toggled by data-stuck). */}
      <div
        data-stuck={isFilterBarStuck || undefined}
        className={cn(
          'sticky top-14 z-20 flex flex-wrap items-center justify-between gap-4 bg-white py-3',
          "before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:w-screen before:-translate-x-1/2 before:border-t before:border-neutral-gray1 before:opacity-0 before:content-['']",
          "after:pointer-events-none after:absolute after:-bottom-px after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-neutral-gray1 after:opacity-0 after:content-['']",
          'data-[stuck=true]:before:opacity-100 data-[stuck=true]:after:opacity-100',
          // On mobile the map view is edge-to-edge, so break the bar out to full
          // width too (restoring the container's 1rem gutter).
          isMapMode &&
            'max-sm:ml-[calc(50%_-_50vw)] max-sm:w-screen max-sm:px-4',
        )}
      >
        <ProposalsListHeader
          hideFilters={hideFilters}
          proposalFilter={proposalFilter}
          // Server-side filtering makes `total` accurate for the active filter.
          count={total}
        />
        {!hideFilters && (
          <div className="flex items-center gap-4">
            <ProposalsFilterBar
              hasVoted={hasVoted}
              currentProfileId={currentProfileId}
              proposalFilter={proposalFilter}
              setProposalFilter={setProposalFilter}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              sortOrder={sortOrder}
              onSelectSort={setSortOrder}
              canManageProposals={canManageProposals}
              isExporting={isExporting}
              isDownloadReady={isDownloadReady}
              downloadUrl={downloadUrl}
              downloadFileName={downloadFileName}
              onExport={onExport}
            />
            {hasLocationField && (
              <div className="hidden items-center gap-4 sm:flex">
                <span aria-hidden className="h-6 w-px bg-neutral-gray2" />
                <ProposalViewToggle
                  value={effectiveView}
                  onChange={onViewChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
