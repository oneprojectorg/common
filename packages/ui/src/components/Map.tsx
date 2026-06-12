'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  type MapRef,
  NavigationControl,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';

import { cn } from '../lib/utils';

export interface LngLat {
  lng: number;
  lat: number;
}

export interface MapProps {
  /** Full map style URL (e.g. a MapTiler `style.json?key=...`). */
  styleUrl: string;
  /**
   * Camera target. Changing this flies the map to the new location — use it
   * for programmatic recentering (search, "use my location"). It is kept
   * intentionally distinct from any marker position so dragging a pin doesn't
   * yank the camera around.
   */
  center: LngLat;
  /** Initial zoom level. */
  zoom?: number;
  /** Disable user pan/zoom/rotate interactions (camera becomes static). */
  interactive?: boolean;
  /** Show the +/- zoom control. Defaults to on. */
  showZoomControl?: boolean;
  /** Called with the clicked coordinate when the user taps the map. */
  onClick?: (lngLat: LngLat) => void;
  /**
   * Called with the settled camera (center + zoom) after the user finishes
   * panning or zooming. Use it to persist a chosen view.
   */
  onMoveEnd?: (view: { center: LngLat; zoom: number }) => void;
  /** Accessible label for the map region. */
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Presentational MapLibre map (via `react-map-gl`). Holds no data, geocoding,
 * or environment access — callers pass a ready style URL and coordinates and
 * compose markers as children. Used by both the editable location picker and
 * the read-only location view.
 */
export function Map({
  styleUrl,
  center,
  zoom = 14,
  interactive = true,
  showZoomControl = true,
  onClick,
  onMoveEnd,
  ariaLabel,
  className,
  children,
}: MapProps) {
  const mapRef = useRef<MapRef>(null);

  // Recenter when the controlled `center` changes (search / use-my-location).
  useEffect(() => {
    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      essential: true,
      duration: 3000,
    });
  }, [center.lng, center.lat]);

  return (
    <div className={cn('relative h-44 w-full sm:h-80', className)}>
      <MapLibreMap
        ref={mapRef}
        mapStyle={styleUrl}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom,
        }}
        interactive={interactive}
        aria-label={ariaLabel}
        style={{ width: '100%', height: '100%' }}
        attributionControl={{ compact: true }}
        onClick={
          onClick
            ? (event: MapLayerMouseEvent) =>
                onClick({ lng: event.lngLat.lng, lat: event.lngLat.lat })
            : undefined
        }
        onMoveEnd={
          onMoveEnd
            ? (event: ViewStateChangeEvent) =>
                onMoveEnd({
                  center: {
                    lng: event.viewState.longitude,
                    lat: event.viewState.latitude,
                  },
                  zoom: event.viewState.zoom,
                })
            : undefined
        }
      >
        {showZoomControl && (
          <NavigationControl position="bottom-right" showCompass={false} />
        )}
        {children}
      </MapLibreMap>
    </div>
  );
}
