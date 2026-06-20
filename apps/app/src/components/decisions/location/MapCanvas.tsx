'use client';

import { Map, type LngLat } from '@op/ui/Map';
import { MapMarker } from '@op/ui/MapMarker';

export interface MapCanvasProps {
  styleUrl: string;
  center: LngLat;
  /** Initial zoom level (defaults to the underlying Map's default). */
  zoom?: number;
  /** Pin position, or null for no marker. */
  marker?: LngLat | null;
  draggable?: boolean;
  onMapClick?: (lngLat: LngLat) => void;
  onMarkerDragEnd?: (lngLat: LngLat) => void;
  /** Called with the settled camera after the user pans or zooms. */
  onMoveEnd?: (view: { center: LngLat; zoom: number }) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * The only module that imports `maplibre-gl` (via `@op/ui/Map`). It is loaded
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
  onMapClick,
  onMarkerDragEnd,
  onMoveEnd,
  ariaLabel,
  className,
}: MapCanvasProps) {
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
