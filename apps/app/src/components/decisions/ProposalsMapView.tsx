'use client';

import { type Proposal, parseProposalData } from '@op/common/client';
import type { MapDefaultView } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { useCallback, useMemo, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ProposalMapHovercard } from './ProposalMapHovercard';
import { ProposalMapListItem } from './ProposalMapListItem';
import { ProposalsMapCanvas } from './location/dynamicProposalsMap';
import { useMapStyleUrl } from './location/mapConfig';

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
 * Map browse view for a process's proposals. Desktop = list + sticky map
 * with hover-driven active state; mobile = map only, first tap shows the
 * preview and a second tap navigates.
 *
 * Map fits all proposal markers (with a buffer) and falls back to the
 * process's default view (`x-map-default`) when no proposal has a location.
 */
// fallow-ignore-next-line complexity
export function ProposalsMapView({
  proposals,
  instanceId,
  slug,
  decisionSlug,
  mapView,
}: ProposalsMapViewProps) {
  const t = useTranslations();
  const router = useRouter();
  const styleUrl = useMapStyleUrl();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const [activeId, setActiveId] = useState<string | null>(null);

  const hrefFor = useCallback(
    (proposal: Proposal) =>
      decisionSlug
        ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
        : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`,
    [decisionSlug, slug, instanceId],
  );

  // One marker per proposal with coordinates (drafts may lack one).
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

  // O(1) lookup so the click handler + hovercard renderer don't scan per call.
  const proposalsById = useMemo(
    () => new Map(proposals.map((proposal) => [proposal.id, proposal])),
    [proposals],
  );

  // Desktop: tap navigates immediately. Mobile: first tap shows the
  // hovercard preview, a second tap on the same pin navigates.
  const handleMarkerClick = useCallback(
    (id: string) => {
      if (isMobile && activeId !== id) {
        setActiveId(id);
        return;
      }
      const proposal = proposalsById.get(id);
      if (proposal) {
        router.push(hrefFor(proposal));
      }
    },
    [isMobile, activeId, proposalsById, router, hrefFor],
  );

  // Only clear when it's still our id — a leave's dismiss-delay timer can
  // land after another pin has become active and would otherwise flicker it.
  const handleMarkerLeave = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  // Mobile: tapping the map background dismisses the open preview.
  const handleMapClick = useCallback(() => {
    setActiveId(null);
  }, []);

  const renderHovercard = useCallback(
    (id: string) => {
      const proposal = proposalsById.get(id);
      if (!proposal) {
        return null;
      }
      return (
        <ProposalMapHovercard proposal={proposal} href={hrefFor(proposal)} />
      );
    },
    [proposalsById, hrefFor],
  );

  // Desktop = hover-driven (marker hover state); mobile = tap-driven via
  // `controlledOpenId`, with map background dismissing the preview.
  const breakpointProps = isMobile
    ? {
        onMarkerEnter: undefined,
        onMarkerLeave: undefined,
        controlledOpenId: activeId,
        onMapClick: handleMapClick,
      }
    : {
        onMarkerEnter: setActiveId,
        onMarkerLeave: handleMarkerLeave,
        controlledOpenId: undefined,
        onMapClick: undefined,
      };

  const map = (
    <ProposalsMapCanvas
      styleUrl={styleUrl}
      center={mapView.center}
      zoom={mapView.zoom}
      points={points}
      activeId={activeId}
      onMarkerClick={handleMarkerClick}
      renderHovercard={renderHovercard}
      ariaLabel={t('Map of proposals')}
      className="h-full sm:h-full"
      {...breakpointProps}
    />
  );

  // Mobile: map fills the screen edge-to-edge. `w-screen` + the negative
  // margin break out of the page container's horizontal padding.
  if (isMobile) {
    return (
      <div className="-mb-4 ml-[calc(50%_-_50vw)] h-[calc(100dvh_-_3.5rem)] w-screen overflow-hidden">
        {map}
      </div>
    );
  }

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
