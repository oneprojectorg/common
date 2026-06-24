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
  /** Fired as the pointer enters/leaves a marker (id, or null on leave). */
  onMarkerHover?: (id: string | null) => void;
  /** Fired when a marker is clicked/tapped. */
  onMarkerClick?: (id: string) => void;
  /**
   * Optional per-pin hovercard. When provided, the returned element is
   * rendered above the pin while the cursor is over the pin or the card.
   * Return `null` (or omit the prop entirely) to suppress the hovercard for
   * a given marker — used by the mobile view, where hover has no analogue.
   */
  renderHovercard?: (id: string) => ReactNode;
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
  onMarkerHover,
  onMarkerClick,
  renderHovercard,
  ariaLabel,
  className,
}: ProposalsMapCanvasProps) {
  const bounds = useMemo(() => getPointsBounds(points), [points]);

  return (
    <Map
      styleUrl={styleUrl}
      center={center}
      zoom={zoom}
      bounds={bounds}
      ariaLabel={ariaLabel}
      className={className}
    >
      {points.map((point) => (
        <ProposalPin
          key={point.id}
          point={point}
          isActive={activeId === point.id}
          onMarkerHover={onMarkerHover}
          onMarkerClick={onMarkerClick}
          renderHovercard={renderHovercard}
        />
      ))}
    </Map>
  );
}

interface ProposalPinProps {
  point: ProposalMapPoint;
  isActive: boolean;
  onMarkerHover?: (id: string | null) => void;
  onMarkerClick?: (id: string) => void;
  renderHovercard?: (id: string) => ReactNode;
}

function ProposalPin({
  point,
  isActive,
  onMarkerHover,
  onMarkerClick,
  renderHovercard,
}: ProposalPinProps) {
  return (
    <MapMarker
      longitude={point.lng}
      latitude={point.lat}
      isActive={isActive}
      onClick={bindCallback(onMarkerClick, point.id)}
      onMouseEnter={bindCallback(onMarkerHover, point.id)}
      onMouseLeave={bindCallback(onMarkerHover, null)}
      hoverContent={renderHovercard?.(point.id)}
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
