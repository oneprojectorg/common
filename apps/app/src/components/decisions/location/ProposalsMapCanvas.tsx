'use client';

import { type LngLat, Map, MapMarker, type MapBounds } from '@op/sense/Map';
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
  onMarkerEnter?: (id: string) => void;
  /**
   * Fires with the leaving id so the consumer can skip clearing its active
   * state when a different marker has since become active (otherwise the
   * deferred dismiss flickers the freshly-hovered pin).
   */
  onMarkerLeave?: (id: string) => void;
  onMarkerClick?: (id: string) => void;
  renderHovercard?: (id: string) => ReactNode;
  /**
   * Forces the matching pin's hovercard open via `MapMarker.isOpen`. Used by
   * the mobile tap-to-preview flow; leave undefined on desktop to let each
   * pin's hover state machine drive the card.
   */
  controlledOpenId?: string | null;
  /** Mobile background-tap dismiss. */
  onMapClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Multi-marker browse map for a process's proposals. Like {@link MapCanvas} it
 * is the only module (besides MapCanvas) that pulls in `maplibre-gl` via
 * `@op/sense/Map`, so it must be loaded through `next/dynamic({ ssr: false })`
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
 * Pre-bind an optional callback so `undefined` passes straight through — the
 * marker uses that to skip its hover/click wiring and cursor change.
 */
function bindCallback<T>(
  fn: ((arg: T) => void) | undefined,
  arg: T,
): (() => void) | undefined {
  return fn ? () => fn(arg) : undefined;
}

/**
 * Bounding box `[[swLng, swLat], [neLng, neLat]]` of every point, or `null`
 * with no points. A single point yields a degenerate box (max-zoom capped).
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
