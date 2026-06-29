'use client';

import { type LngLat, Map, type MapBounds } from '@op/ui/Map';
import { MapMarker } from '@op/ui/MapMarker';
import { type ReactNode, useMemo } from 'react';

export interface ProposalMapPoint {
  id: string;
  lng: number;
  lat: number;
}

export interface ProposalsMapCanvasProps {
  styleUrl: string;
  /** Fallback camera target — the process's default view (`x-map-default`),
   * used only when there are no points to fit. */
  center: LngLat;
  /** Fallback zoom from the process's default view. */
  zoom?: number;
  points: ProposalMapPoint[];
  /** Id of the proposal whose marker should be highlighted. */
  activeId?: string | null;
  /** Fired when the pointer enters a marker. */
  onMarkerEnter?: (id: string) => void;
  /**
   * Fired when the pointer leaves a marker. The id of the marker being left
   * is passed so the consumer can skip clobbering its own active state when
   * a different marker has since become active — without this the deferred
   * dismiss on a previously-hovered pin would null out the freshly-hovered
   * one and the new pin would flicker.
   */
  onMarkerLeave?: (id: string) => void;
  /** Fired when a marker is clicked/tapped. */
  onMarkerClick?: (id: string) => void;
  /**
   * Optional per-pin hovercard. When provided, the returned element is
   * rendered above the pin while the cursor is over the pin (desktop) or
   * after the first tap on the pin (mobile, see `controlledOpenId`).
   */
  renderHovercard?: (id: string) => ReactNode;
  /**
   * When set, the matching pin's hovercard is forced open via the controlled
   * `isOpen` prop on `MapMarker` — used by the mobile "tap to preview" flow,
   * where the open state is driven by the parent's tap-tracked `activeId`
   * instead of by mouseenter/mouseleave (which touch devices don't fire
   * reliably). Pass `null` (the default) on desktop to let each pin's hover
   * state machine manage the card itself.
   */
  controlledOpenId?: string | null;
  /**
   * Fires when the user clicks/taps the map background (not a marker). The
   * mobile flow uses this to dismiss the open hovercard when the user taps
   * outside any pin.
   */
  onMapClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Multi-marker browse map for a process's proposals. Like {@link MapCanvas} it
 * is the only module (besides MapCanvas) that pulls in `maplibre-gl` via
 * `@op/ui/Map`, so it must be loaded through `next/dynamic({ ssr: false })`
 * (see `dynamicProposalsMap`) to keep the heavy, browser-only map library out
 * of the server bundle.
 *
 * The camera fits all proposal markers (with a buffer), re-fitting whenever the
 * set changes (e.g. category filtering). It falls back to the process's default
 * view only when no proposal has a location.
 */
export default function ProposalsMapCanvas({
  styleUrl,
  center,
  zoom,
  points,
  activeId,
  onMarkerEnter,
  onMarkerLeave,
  onMarkerClick,
  renderHovercard,
  controlledOpenId,
  onMapClick,
  ariaLabel,
  className,
}: ProposalsMapCanvasProps) {
  const bounds = useMemo(() => getPointsBounds(points), [points]);
  const isOpenControlled = controlledOpenId !== undefined;

  return (
    <Map
      styleUrl={styleUrl}
      center={center}
      zoom={zoom}
      bounds={bounds}
      ariaLabel={ariaLabel}
      className={className}
      onClick={onMapClick}
    >
      {points.map((point) => (
        <ProposalPin
          key={point.id}
          point={point}
          isActive={activeId === point.id}
          onMarkerEnter={onMarkerEnter}
          onMarkerLeave={onMarkerLeave}
          onMarkerClick={onMarkerClick}
          renderHovercard={renderHovercard}
          isOpen={isOpenControlled ? controlledOpenId === point.id : undefined}
        />
      ))}
    </Map>
  );
}

interface ProposalPinProps {
  point: ProposalMapPoint;
  isActive: boolean;
  onMarkerEnter?: (id: string) => void;
  onMarkerLeave?: (id: string) => void;
  onMarkerClick?: (id: string) => void;
  renderHovercard?: (id: string) => ReactNode;
  isOpen?: boolean;
}

function ProposalPin({
  point,
  isActive,
  onMarkerEnter,
  onMarkerLeave,
  onMarkerClick,
  renderHovercard,
  isOpen,
}: ProposalPinProps) {
  return (
    <MapMarker
      longitude={point.lng}
      latitude={point.lat}
      isActive={isActive}
      onClick={bindCallback(onMarkerClick, point.id)}
      onMouseEnter={bindCallback(onMarkerEnter, point.id)}
      onMouseLeave={bindCallback(onMarkerLeave, point.id)}
      hoverContent={renderHovercard?.(point.id)}
      isOpen={isOpen}
    />
  );
}

/**
 * Pre-bind an optional callback with the given argument so the marker can
 * pass `undefined` straight through (which it uses to skip its hover / click
 * wiring and the matching CSS cursor change).
 */
function bindCallback<T>(
  fn: ((arg: T) => void) | undefined,
  arg: T,
): (() => void) | undefined {
  return fn ? () => fn(arg) : undefined;
}

/**
 * Bounding box enclosing every point as `[[swLng, swLat], [neLng, neLat]]`, or
 * `null` when there are no points (the map then falls back to its default view).
 * A single point yields a degenerate box that the map fits with a max-zoom cap.
 */
function getPointsBounds(points: ProposalMapPoint[]): MapBounds | null {
  const first = points[0];
  if (!first) {
    return null;
  }

  let minLng = first.lng;
  let minLat = first.lat;
  let maxLng = first.lng;
  let maxLat = first.lat;

  for (const point of points) {
    minLng = Math.min(minLng, point.lng);
    minLat = Math.min(minLat, point.lat);
    maxLng = Math.max(maxLng, point.lng);
    maxLat = Math.max(maxLat, point.lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
