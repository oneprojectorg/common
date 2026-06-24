'use client';

import { type Proposal, parseProposalData } from '@op/common/client';
import type { MapDefaultView } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { FieldError } from '@op/ui/Field';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ProposalMapListItem } from './ProposalMapListItem';
import { ProposalMapHoverCard } from './location/ProposalMapHoverCard';
import type { ProposalMapPoint } from './location/ProposalsMapCanvas';
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
 * How long we wait, after the cursor leaves a marker, before clearing the
 * shared active state. Long enough for the cursor to transit the small gap
 * between pin and hovercard; short enough to feel responsive when leaving the
 * marker for good.
 */
const HOVER_DISMISS_DELAY_MS = 150;

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
  // Debounce clearing the active state so the cursor can transit from the pin
  // to its hovercard without the card snapping closed. A pending close is
  // cancelled whenever the cursor enters another hover target (pin or card).
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingDismiss = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  // Make sure the timer doesn't outlive the component (e.g. on navigation).
  // `cancelPendingDismiss` is stable (memoized with empty deps), so this
  // effect's cleanup fires exactly once, on unmount.
  useEffect(() => cancelPendingDismiss, [cancelPendingDismiss]);

  const handleMarkerHover = useCallback(
    (id: string | null) => {
      cancelPendingDismiss();
      if (id === null) {
        dismissTimer.current = setTimeout(() => {
          setActiveId(null);
          dismissTimer.current = null;
        }, HOVER_DISMISS_DELAY_MS);
        return;
      }
      setActiveId(id);
    },
    [cancelPendingDismiss],
  );

  // Pin-and-card pixel offsets stop being meaningful mid-zoom, so dismiss the
  // active state immediately when the user starts zooming.
  const handleZoomStart = useCallback(() => {
    cancelPendingDismiss();
    setActiveId(null);
  }, [cancelPendingDismiss]);

  const hrefFor = useCallback(
    (proposal: Proposal) =>
      decisionSlug
        ? `/decisions/${decisionSlug}/proposal/${proposal.profileId}`
        : `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`,
    [decisionSlug, slug, instanceId],
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

  // One marker per proposal that has coordinates. Location is mandatory for
  // these processes, so this is virtually every proposal (drafts may lack one).
  // Mobile skips the hovercard payload — touch users never see it (the marker
  // tap navigates straight to the proposal) and building it would only widen
  // mobile bundles for no behavior change.
  const points = useMemo<ProposalMapPoint[]>(
    () =>
      proposals.flatMap((proposal) => {
        const location = parseProposalData(proposal.proposalData).location;
        if (!location) {
          return [];
        }
        return [
          {
            id: proposal.id,
            lng: location.lng,
            lat: location.lat,
            hoverCard: isMobile ? undefined : (
              <ProposalMapHoverCard
                proposal={proposal}
                href={hrefFor(proposal)}
              />
            ),
          },
        ];
      }),
    [proposals, isMobile, hrefFor],
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
      onMarkerHover={isMobile ? undefined : handleMarkerHover}
      onMarkerClick={handleMarkerClick}
      onZoomStart={isMobile ? undefined : handleZoomStart}
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
            onActivate={() => handleMarkerHover(proposal.id)}
            onDeactivate={() => handleMarkerHover(null)}
          />
        ))}
      </ul>
      <aside className="sticky top-[8.25rem] hidden h-[calc(100dvh_-_9rem)] overflow-hidden rounded-lg border border-neutral-gray1 sm:block">
        {map}
      </aside>
    </div>
  );
}
