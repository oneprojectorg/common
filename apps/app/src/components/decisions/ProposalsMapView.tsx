'use client';

import { type Proposal, parseProposalData } from '@op/common/client';
import type { MapDefaultView } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { FieldError } from '@op/ui/Field';
import { useCallback, useMemo, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ProposalMapListItem } from './ProposalMapListItem';
import { ProposalsMapCanvas } from './location/dynamicProposalsMap';
import { MAP_STYLE_URL } from './location/mapConfig';

interface ProposalsMapViewProps {
  proposals: Proposal[];
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links. */
  decisionSlug?: string;
  /** Fallback camera — the process's default view, used only when no proposal
   * has a location to fit. */
  mapView: MapDefaultView;
}

/**
 * The map browse view for a process's proposals. On desktop it shows the list
 * (left) beside a sticky map (right); hovering a row or marker drives a single
 * shared active state, and clicking a marker opens the proposal. On mobile it
 * shows just the map (the list is the regular grid, toggled separately) and
 * tapping a marker likewise opens the proposal.
 *
 * The map fits all proposal markers (with a buffer), re-fitting as the set is
 * filtered, and falls back to the process's default view (`x-map-default`) only
 * when no proposal has a location.
 */
export function ProposalsMapView({
  proposals,
  instanceId,
  slug,
  decisionSlug,
  mapView,
}: ProposalsMapViewProps) {
  const t = useTranslations();
  const router = useRouter();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const [activeId, setActiveId] = useState<string | null>(null);

  const hrefFor = useCallback(
    (proposal: Proposal) =>
      decisionSlug
        ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
        : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`,
    [decisionSlug, slug, instanceId],
  );

  // One marker per proposal that has coordinates. Location is mandatory for
  // these processes, so this is virtually every proposal (drafts may lack one).
  const points = useMemo(
    () =>
      proposals.flatMap((proposal) => {
        const location = parseProposalData(proposal.proposalData).location;
        return location
          ? [{ id: proposal.id, lng: location.lng, lat: location.lat }]
          : [];
      }),
    [proposals],
  );

  // Clicking a marker opens the proposal on every breakpoint; on desktop the
  // shared active state is still driven by hover (see `onMarkerHover`).
  const handleMarkerClick = useCallback(
    (id: string) => {
      const proposal = proposals.find((p) => p.id === id);
      if (proposal) {
        router.push(hrefFor(proposal));
      }
    },
    [proposals, router, hrefFor],
  );

  if (!MAP_STYLE_URL) {
    return (
      <FieldError>
        {t('The map is unavailable because it has not been configured.')}
      </FieldError>
    );
  }

  const map = (
    <ProposalsMapCanvas
      styleUrl={MAP_STYLE_URL}
      center={mapView.center}
      zoom={mapView.zoom}
      points={points}
      activeId={activeId}
      onMarkerHover={isMobile ? undefined : setActiveId}
      onMarkerClick={handleMarkerClick}
      ariaLabel={t('Map of proposals')}
      className="h-full sm:h-full"
    />
  );

  // Mobile: the map fills the screen edge-to-edge (no gutters/border). `w-screen`
  // + the negative margin break out of the page container's horizontal padding;
  // the height plus the page's `max-sm:pb-0` make it flush to the bottom of the
  // viewport once the banner has scrolled away beneath the sticky filter bar.
  if (isMobile) {
    return (
      <div className="-mb-4 ml-[calc(50%_-_50vw)] h-[calc(100dvh_-_3.5rem)] w-screen overflow-hidden">
        {map}
      </div>
    );
  }

  // Desktop: list (left) beside a sticky, viewport-filling map (right).
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <ul className="flex min-w-0 flex-col gap-6">
        {proposals.map((proposal) => (
          <ProposalMapListItem
            key={proposal.id}
            proposal={proposal}
            href={hrefFor(proposal)}
            isActive={activeId === proposal.id}
            onActivate={() => setActiveId(proposal.id)}
            onDeactivate={() => setActiveId(null)}
          />
        ))}
      </ul>
      <aside className="sticky top-[8.25rem] hidden h-[calc(100dvh_-_9rem)] overflow-hidden rounded-lg border border-neutral-gray1 sm:block">
        {map}
      </aside>
    </div>
  );
}
