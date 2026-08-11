'use client';

import { trpc } from '@op/api/client';
import type { DecisionAccess, ProposalStatus } from '@op/api/encoders';
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

/** Filter for the all-locations pin query — shared with the list, minus the
 * list-only pagination fields (the map returns every located proposal). */
interface ProposalLocationFilter {
  processInstanceId: string;
  categoryId?: string;
  submittedByProfileId?: string;
  votedByProfileId?: string;
  status?: ProposalStatus;
  excludeAssignedForReview?: boolean;
  phase?: 'results';
}

interface ProposalsMapViewProps {
  /** Loaded list pages — drives the desktop list column (stays paginated). */
  proposals: Proposal[];
  /** Marker source. Every located proposal the pins should plot, which can be
   * a wider set than `proposals` (the loaded list pages). */
  pinProposals: Proposal[];
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links. */
  decisionSlug?: string;
  /** Open revision requests, keyed by proposal id — drives the revise action. */
  revisionRequestIdByProposalId?: Map<string, string>;
  /** Role-based capabilities for the current user — drives the admin
   * proposal menu on each list-column card (same logic as the grid view). */
  permissions?: DecisionAccess | null;
  /** Fallback camera — the process's default view, used only when no proposal
   * has a location to fit. */
  mapView: MapDefaultView;
  /** Rendered after the last list item on desktop — hosts the infinite-scroll
   * sentinel inside the list column so loading more never adds space below
   * the sticky map. Mobile (map only, no list) never renders it. */
  listFooter?: React.ReactNode;
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
  pinProposals,
  instanceId,
  slug,
  decisionSlug,
  permissions,
  revisionRequestIdByProposalId,
  mapView,
  listFooter,
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
      pinProposals.flatMap((proposal) => {
        const location = parseProposalData(proposal.proposalData).location;
        return location
          ? [{ id: proposal.id, lng: location.lng, lat: location.lat }]
          : [];
      }),
    [pinProposals],
  );

  // O(1) lookup so the click handler + hovercard renderer don't scan per call.
  // Keyed off the full pin set so pins beyond the loaded list pages still
  // resolve a proposal for navigation and their hovercard.
  const proposalsById = useMemo(
    () => new Map(pinProposals.map((proposal) => [proposal.id, proposal])),
    [pinProposals],
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
      <div className="ms-[calc(50%_-_50vw)] -mb-4 h-[calc(100dvh_-_3.5rem)] w-screen overflow-hidden">
        {map}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(320px,720px)_minmax(60%,1fr)]">
      <ul className="flex min-w-0 flex-col gap-6">
        {proposals.map((proposal) => (
          <ProposalMapListItem
            key={proposal.id}
            proposal={proposal}
            instanceId={instanceId}
            slug={slug}
            decisionSlug={decisionSlug}
            permissions={permissions}
            revisionRequestId={revisionRequestIdByProposalId?.get(proposal.id)}
            isActive={activeId === proposal.id}
            onActivate={() => setActiveId(proposal.id)}
            onDeactivate={() => setActiveId(null)}
          />
        ))}
        {listFooter && <li>{listFooter}</li>}
      </ul>
      <aside className="sticky top-20 hidden h-[calc(100dvh_-_10rem)] overflow-hidden rounded-lg border border-border sm:block">
        {map}
      </aside>
    </div>
  );
}

/**
 * Loads every located proposal in scope from `listProposalLocations` and feeds
 * them to the map as pins, so the map isn't capped by the list's page size.
 * Used for the phase-scoped browse map; the results phase renders
 * `ProposalsMapView` directly with its `listAllProposals` data so the pins
 * match that list's (phase-agnostic) scope.
 */
export function ProposalsMapWithLocations({
  locationFilter,
  ...props
}: Omit<ProposalsMapViewProps, 'pinProposals'> & {
  locationFilter: ProposalLocationFilter;
}) {
  const [{ proposals: pinProposals }] =
    trpc.decision.listProposalLocations.useSuspenseQuery(locationFilter, {
      staleTime: 30 * 1000,
      // Force a client-side fetch so the query registers its invalidation
      // channel via the client link (same pattern as the list query).
      refetchOnMount: 'always',
    });

  return <ProposalsMapView {...props} pinProposals={pinProposals} />;
}
