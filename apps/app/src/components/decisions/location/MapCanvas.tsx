'use client';

import { Map, type LngLat } from '@op/ui/Map';
import { MapMarker } from '@op/ui/MapMarker';

export interface MapCanvasProps {
  styleUrl: string;
  center: LngLat;
  /** Pin position, or null for no marker. */
  marker?: LngLat | null;
  draggable?: boolean;
  onMapClick?: (lngLat: LngLat) => void;
  onMarkerDragEnd?: (lngLat: LngLat) => void;
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
  marker,
  draggable = false,
  onMapClick,
  onMarkerDragEnd,
  ariaLabel,
  className,
}: MapCanvasProps) {
  return (
    <Map
      styleUrl={styleUrl}
      center={center}
      onClick={onMapClick}
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
