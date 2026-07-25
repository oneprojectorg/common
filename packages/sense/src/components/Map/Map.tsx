'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';
import {
  Layer,
  type LayerProps,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  type MapRef,
  NavigationControl,
  Source,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';

// Re-exported so feature code (e.g. the location picker's boundary overlay)
// can compose MapLibre `Source`/`Layer` children without taking a direct
// dependency on `react-map-gl` — the package only lives in `@op/sense`.
export { Layer, Source };
export type { LayerProps };

import { cn } from '../../lib/utils';

export interface LngLat {
  lng: number;
  lat: number;
}

/** A bounding box as `[[swLng, swLat], [neLng, neLat]]`. */
export type MapBounds = [[number, number], [number, number]];

/** Default pixel buffer kept around fitted `bounds`. */
const DEFAULT_BOUNDS_PADDING = 48;

/** Cap fitted zoom so a single/tightly-clustered set doesn't slam to street level. */
const BOUNDS_FIT_MAX_ZOOM = 15;

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
  /**
   * When set, the camera fits these bounds (with `boundsPadding`) instead of
   * `center`/`zoom`, and re-fits whenever they change (e.g. a filtered marker
   * set). Pass `null` to fall back to `center`/`zoom`.
   */
  bounds?: MapBounds | null;
  /** Pixel buffer kept around `bounds` when fitting. Defaults to 48. */
  boundsPadding?: number;
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
  bounds,
  boundsPadding = DEFAULT_BOUNDS_PADDING,
  interactive = true,
  showZoomControl = true,
  onClick,
  onMoveEnd,
  ariaLabel,
  className,
  children,
}: MapProps) {
  const mapRef = useRef<MapRef>(null);
  // The initial center is already applied via `initialViewState`, so skip the
  // first effect run — otherwise the map flies from the initial center to the
  // same point on mount (a pointless 3s animation).
  const hasMountedRef = useRef(false);

  // Stabilize `bounds` by its coordinates so an inline literal (a fresh ref
  // each render) doesn't re-fire the effects below every render. Consumers
  // then don't have to memoize it themselves.
  const boundsKey = bounds ? bounds.flat().join(',') : null;
  const stableBounds = useMemo(() => bounds, [boundsKey]);

  // True only if bounds were present at mount — those are already applied via
  // `initialViewState`, so the effect below must skip its first fit or the map
  // animates to bounds it's already showing.
  const boundsAppliedOnMountRef = useRef(bounds != null);

  // Fit the camera to `bounds` whenever they change (e.g. the marker set is
  // filtered). Takes precedence over `center`/`zoom`.
  useEffect(() => {
    if (!stableBounds) {
      return;
    }
    if (boundsAppliedOnMountRef.current) {
      boundsAppliedOnMountRef.current = false;
      return;
    }
    mapRef.current?.fitBounds(stableBounds, {
      padding: boundsPadding,
      maxZoom: BOUNDS_FIT_MAX_ZOOM,
      duration: 1000,
    });
  }, [stableBounds, boundsPadding]);

  // Recenter when the controlled `center` changes (search / use-my-location).
  // Skipped while `bounds` drives the camera so the two don't fight.
  useEffect(() => {
    if (stableBounds) {
      return;
    }
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    mapRef.current?.flyTo({
      center: [center.lng, center.lat],
      essential: true,
      duration: 3000,
    });
  }, [center.lng, center.lat, stableBounds]);

  return (
    <div className={cn('relative h-44 w-full sm:h-80', className)}>
      <MapLibreMap
        ref={mapRef}
        mapStyle={styleUrl}
        initialViewState={
          bounds
            ? {
                bounds,
                fitBoundsOptions: {
                  padding: boundsPadding,
                  maxZoom: BOUNDS_FIT_MAX_ZOOM,
                },
              }
            : {
                longitude: center.lng,
                latitude: center.lat,
                zoom,
              }
        }
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
