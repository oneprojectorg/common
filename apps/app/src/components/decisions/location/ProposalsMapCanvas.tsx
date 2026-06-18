'use client';

import { Map, type LngLat } from '@op/ui/Map';
import { MapMarker } from '@op/ui/MapMarker';

export interface ProposalMapPoint {
  id: string;
  lng: number;
  lat: number;
}

export interface ProposalsMapCanvasProps {
  styleUrl: string;
  /** Camera target — the process's configured default view (`x-map-default`). */
  center: LngLat;
  /** Initial zoom from the process's default view. */
  zoom?: number;
  points: ProposalMapPoint[];
  /** Id of the proposal whose marker should be highlighted. */
  activeId?: string | null;
  /** Fired as the pointer enters/leaves a marker (id, or null on leave). */
  onMarkerHover?: (id: string | null) => void;
  /** Fired when a marker is clicked/tapped. */
  onMarkerClick?: (id: string) => void;
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
 * The camera is the process's default view — it does **not** fit to the
 * markers — so the browse map matches what proposers see on the submission form.
 */
export default function ProposalsMapCanvas({
  styleUrl,
  center,
  zoom,
  points,
  activeId,
  onMarkerHover,
  onMarkerClick,
  ariaLabel,
  className,
}: ProposalsMapCanvasProps) {
  return (
    <Map
      styleUrl={styleUrl}
      center={center}
      zoom={zoom}
      ariaLabel={ariaLabel}
      className={className}
    >
      {points.map((point) => (
        <MapMarker
          key={point.id}
          longitude={point.lng}
          latitude={point.lat}
          isActive={activeId === point.id}
          onClick={onMarkerClick ? () => onMarkerClick(point.id) : undefined}
          onMouseEnter={
            onMarkerHover ? () => onMarkerHover(point.id) : undefined
          }
          onMouseLeave={onMarkerHover ? () => onMarkerHover(null) : undefined}
        />
      ))}
    </Map>
  );
}
