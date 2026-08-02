'use client';

import type { BoundaryShape } from '@op/api/encoders';
import {
  Layer,
  type LayerProps,
  type LngLat,
  Map,
  MapMarker,
  Source,
} from '@op/sense/Map';
import { useMemo } from 'react';

export interface MapCanvasProps {
  styleUrl: string;
  center: LngLat;
  /** Initial zoom level (defaults to the underlying Map's default). */
  zoom?: number;
  /** Pin position, or null for no marker. */
  marker?: LngLat | null;
  draggable?: boolean;
  /**
   * Decision boundaries rendered as a translucent teal overlay beneath the
   * marker. Pass an empty array (or omit) to hide the overlay.
   */
  boundaries?: BoundaryShape[];
  onMapClick?: (lngLat: LngLat) => void;
  onMarkerDragEnd?: (lngLat: LngLat) => void;
  /** Called with the settled camera after the user pans or zooms. */
  onMoveEnd?: (view: { center: LngLat; zoom: number }) => void;
  ariaLabel?: string;
  className?: string;
}

const BOUNDARY_SOURCE_ID = 'decision-boundaries';

// MapLibre paint expressions take CSS color strings, not Tailwind tokens, so
// we inline the literal values of the brand teal tokens. Pinned here as the
// single source of truth — if a token ever shifts, update the constant in
// lockstep.
const PRIMARY_TEAL = '#387582'; // --op-primary-600 / primary-teal
const PRIMARY_TEAL_50 = '#F1F9FA'; // --op-primary-50 / primary-teal-50

// Boundary fill in primary-teal-50 (per design) with the outline at full
// primary-teal. The fill opacity of 0.32 matches the Figma spec.
const BOUNDARY_FILL_LAYER: LayerProps = {
  id: 'decision-boundaries-fill',
  type: 'fill',
  source: BOUNDARY_SOURCE_ID,
  paint: {
    'fill-color': PRIMARY_TEAL_50,
    'fill-opacity': 0.32,
  },
};

const BOUNDARY_OUTLINE_LAYER: LayerProps = {
  id: 'decision-boundaries-outline',
  type: 'line',
  source: BOUNDARY_SOURCE_ID,
  paint: {
    'line-color': PRIMARY_TEAL,
    'line-width': 1.5,
  },
};

/**
 * The only module that imports `maplibre-gl` (via `@op/sense/Map`). It is loaded
 * exclusively through `next/dynamic({ ssr: false })` so the heavy, browser-only
 * map library never enters the server bundle — which both avoids SSR `window`
 * access and keeps it out of the route's server compile (a static import here
 * OOM-killed the dev server).
 */
export default function MapCanvas({
  styleUrl,
  center,
  zoom,
  marker,
  draggable = false,
  boundaries,
  onMapClick,
  onMarkerDragEnd,
  onMoveEnd,
  ariaLabel,
  className,
}: MapCanvasProps) {
  const boundaryCollection = useMemo(
    () => buildBoundaryFeatureCollection(boundaries),
    [boundaries],
  );

  return (
    <Map
      styleUrl={styleUrl}
      center={center}
      zoom={zoom}
      onClick={onMapClick}
      onMoveEnd={onMoveEnd}
      ariaLabel={ariaLabel}
      className={className}
    >
      {boundaryCollection && (
        <Source
          id={BOUNDARY_SOURCE_ID}
          type="geojson"
          data={boundaryCollection}
        >
          <Layer {...BOUNDARY_FILL_LAYER} />
          <Layer {...BOUNDARY_OUTLINE_LAYER} />
        </Source>
      )}
      {marker && (
        <MapMarker
          longitude={marker.lng}
          latitude={marker.lat}
          draggable={draggable}
          onDragEnd={onMarkerDragEnd}
        />
      )}
    </Map>
  );
}

interface BoundaryFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: BoundaryShape['geometry'];
    properties: { id: string; name: string };
  }[];
}

/**
 * Wraps the boundaries returned by `decision.listBoundaryShapes` as a GeoJSON
 * `FeatureCollection` for the MapLibre `Source`. Returns `null` when there is
 * nothing to render so the consumer can skip the `<Source>` entirely.
 */
function buildBoundaryFeatureCollection(
  boundaries: BoundaryShape[] | undefined,
): BoundaryFeatureCollection | null {
  if (!boundaries || boundaries.length === 0) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: boundaries.map((boundary) => ({
      type: 'Feature',
      geometry: boundary.geometry,
      properties: { id: boundary.id, name: boundary.name },
    })),
  };
}
