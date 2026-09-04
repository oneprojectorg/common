'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { trpc } from '@op/api/client';
import type { ProposalStatus } from '@op/api/encoders';
import type { ProposalReviewAssignmentStatus } from '@op/common/client';
import { type Proposal, parseProposalData } from '@op/common/client';
import type { MapDefaultView } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, memo, useCallback, useMemo, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ProposalMapHovercard } from './ProposalMapHovercard';
import { ProposalsMapCanvas } from './location/dynamicProposalsMap';
import { useMapStyleUrl } from './location/mapConfig';

/** Filter for the all-locations pin query — shared with the list, minus the
 * list-only pagination fields (the map returns every located proposal). */
interface ProposalLocationFilter {
  processInstanceId: string;
  categoryId?: string;
  search?: string;
  submittedByProfileId?: string;
  votedByProfileId?: string;
  status?: ProposalStatus;
  excludeAssignedForReview?: boolean;
  phase?: 'results';
}

/** Filter for the reviewer queue's pin query — the queue's own filters, minus
 * the list-only pagination fields (the map returns every located assignment). */
interface ReviewAssignmentLocationFilter {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
}

/** Renders one proposal in the desktop list column. The view owns the active
 * highlight, so it hands the card the `className` carrying that policy. */
type RenderProposalCard = (
  proposal: Proposal,
  opts: { className: string },
) => ReactNode;

interface ProposalsMapViewProps {
  /** Loaded list pages — drives the desktop list column (stays paginated). */
  proposals: Proposal[];
  /** Marker source. Every located proposal the pins should plot, which can be
   * a wider set than `proposals` (the loaded list pages). */
  pinProposals: Proposal[];
  /** The list column's card. MUST be `useCallback`'d by the call site — the
   * memoized rows compare on it, and a fresh function re-renders every row. */
  renderCard: RenderProposalCard;
  /** Where a proposal leads. Feeds both pin-click navigation and the
   * hovercard, so the two can't disagree. */
  hrefFor: (proposal: Proposal) => string;
  /** Fallback camera — the process's default view, used only when no proposal
   * has a location to fit. */
  mapView: MapDefaultView;
  /** Rendered after the last list item on desktop — hosts the infinite-scroll
   * sentinel inside the list column so loading more never adds space below
   * the sticky map. Mobile (map only, no list) never renders it. */
  listFooter?: React.ReactNode;
  /**
   * Takes the list column's place when a filter matched nothing. The map stays
   * — it's the other half of the answer, and its pins are gone too.
   */
  emptyState?: React.ReactNode;
}

/**
 * Map view for a set of proposals. Desktop = list + sticky map with
 * hover-driven active state; mobile = map only, first tap shows the preview
 * and a second tap navigates.
 *
 * The list column is pluggable (`renderCard`) so surfaces with their own card
 * — browse, the review queue — share this machinery instead of copying it.
 *
 * Map fits all proposal markers (with a buffer) and falls back to the
 * process's default view (`x-map-default`) when no proposal has a location.
 */
// fallow-ignore-next-line complexity
export function ProposalsMapView({
  proposals,
  pinProposals,
  renderCard,
  hrefFor,
  mapView,
  listFooter,
  emptyState,
}: ProposalsMapViewProps) {
  const t = useTranslations();
  const router = useRouter();
  const styleUrl = useMapStyleUrl();
  const isMobile = useIsMobile();

  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Stable so the memoized rows survive an `activeId` change: a hover then
  // re-renders the two rows whose `isActive` flipped, not the whole column.
  const handleRowEnter = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleRowLeave = useCallback(() => {
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
      {emptyState && proposals.length === 0 ? (
        // `items-start` so the state sits at the top of the column rather than
        // centring itself against the full height of the map beside it.
        <div className="flex min-w-0 items-start">{emptyState}</div>
      ) : (
        <ul className="flex min-w-0 flex-col gap-6">
          {proposals.map((proposal) => (
            <MapListRow
              key={proposal.id}
              proposal={proposal}
              isActive={activeId === proposal.id}
              onEnter={handleRowEnter}
              onLeave={handleRowLeave}
              renderCard={renderCard}
            />
          ))}
          {listFooter && <li>{listFooter}</li>}
        </ul>
      )}
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

/**
 * The reviewer queue's pin source: every located proposal the caller is
 * assigned to review, which is a different question than
 * `listProposalLocations` answers — asked from the assignment side so the map
 * can never plot a proposal this reviewer wasn't assigned. Same output shape,
 * so the view below consumes it unchanged.
 */
export function ReviewAssignmentsMapWithLocations({
  locationFilter,
  ...props
}: Omit<ProposalsMapViewProps, 'pinProposals'> & {
  locationFilter: ReviewAssignmentLocationFilter;
}) {
  const [{ proposals: pinProposals }] =
    trpc.decision.listReviewAssignmentLocations.useSuspenseQuery(
      locationFilter,
      {
        staleTime: 30 * 1000,
        // Force a client-side fetch so the query registers its invalidation
        // channel via the client link (same pattern as the list query).
        refetchOnMount: 'always',
      },
    );

  return <ProposalsMapView {...props} pinProposals={pinProposals} />;
}

interface MapListRowProps {
  proposal: Proposal;
  /** The map is pointing at this row — either a pin hover or its own. */
  isActive: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  renderCard: RenderProposalCard;
}

/**
 * One row of the desktop list column. Memoized because `activeId` lives in
 * `ProposalsMapView`: without this, hovering one pin re-renders every card in
 * the column. Holds the active-highlight class policy so a call site's
 * `renderCard` only has to spread the `className` it is handed.
 */
const MapListRow = memo(function MapListRow({
  proposal,
  isActive,
  onEnter,
  onLeave,
  renderCard,
}: MapListRowProps) {
  return (
    <li onMouseEnter={() => onEnter(proposal.id)} onMouseLeave={onLeave}>
      {renderCard(proposal, {
        className: cn(
          // `min-w-0` so a long title can't widen the list column.
          'min-w-0 transition-colors',
          // Hovering a row highlights its pin, so `activeId` is set from
          // either end. `not-[:hover]` is what keeps the two apart: the
          // tint means "the map is pointing at this", and the pointer
          // doesn't repaint the row it's already on.
          isActive && 'border-input not-[:hover]:bg-muted',
        ),
      })}
    </li>
  );
});
