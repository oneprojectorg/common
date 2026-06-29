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
 * The map browse view for a process's proposals. On desktop it shows the list
 * (left) beside a sticky map (right); hovering a row or marker drives a single
 * shared active state, and clicking a marker opens the proposal. On mobile it
 * shows just the map and the first tap on a pin shows its hovercard preview;
 * a second tap on the same pin navigates, and tapping the map background
 * dismisses the preview.
 *
 * The map fits all proposal markers (with a buffer), re-fitting as the set is
 * filtered, and falls back to the process's default view (`x-map-default`) only
 * when no proposal has a location.
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

  // O(1) lookup by proposal id — used by both the marker-click handler and
  // the per-pin hovercard renderer, both of which would otherwise scan
  // `proposals` on every call.
  const proposalsById = useMemo(
    () => new Map(proposals.map((proposal) => [proposal.id, proposal])),
    [proposals],
  );

  // Desktop: tap navigates immediately (hover already showed the card).
  // Mobile: first tap on a new pin shows its hovercard; only a second tap on
  // the same pin (now the active one) navigates. Tapping a different pin
  // moves the preview to that one — no navigation. Tap outside any pin
  // dismisses the card (see `handleMapClick` below).
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

  // The marker's leave callback fires after its dismiss-delay timer, which
  // can land AFTER the cursor has already entered another marker. We only
  // clear `activeId` when it's still ours — otherwise a leave from the
  // previously-hovered pin would clobber the freshly-hovered one and the
  // new pin would flicker out of its active state.
  const handleMarkerLeave = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  // Mobile: tapping the map background (outside any pin) dismisses the
  // currently-previewed pin's card. Marker clicks stop propagation, so this
  // only fires for genuine background taps.
  const handleMapClick = useCallback(() => {
    setActiveId(null);
  }, []);

  // The card content is the same on desktop and mobile — on desktop it's
  // gated by the marker's hover state machine, on mobile by the controlled
  // `controlledOpenId` (the tap-tracked `activeId`).
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

  // Desktop = hover-driven card via the marker's internal state machine;
  // mobile = tap-driven card via the parent's `activeId` (controlledOpenId),
  // with the map background dismissing the preview.
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
