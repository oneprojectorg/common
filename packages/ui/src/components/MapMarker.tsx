'use client';

import { useId } from 'react';
import { Marker, type MarkerDragEvent } from 'react-map-gl/maplibre';

import { cn } from '../lib/utils';
import type { LngLat } from './Map';

export interface MapMarkerProps {
  longitude: number;
  latitude: number;
  /** Allow the user to drag the pin; fires `onDragEnd` on release. */
  draggable?: boolean;
  onDragEnd?: (lngLat: LngLat) => void;
}

/**
 * A map-pin marker for {@link Map}, anchored at its tip. Presentational only —
 * dragging reports the new coordinate through `onDragEnd`; the parent owns the
 * position.
 *
 * Uses Lucide's `map-pin` geometry filled with the brand BlueGreen radial
 * gradient (`Gradients/BlueGreen` — `bg-blueGreen` in @op/styles).
 */
export function MapMarker({
  longitude,
  latitude,
  draggable = false,
  onDragEnd,
}: MapMarkerProps) {
  // Unique per instance so multiple markers on one page don't collide on the
  // gradient's `id` (referenced via `url(#…)`, which resolves by document id).
  const gradientId = useId();

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      draggable={draggable}
      onDragEnd={
        onDragEnd
          ? (event: MarkerDragEvent) =>
              onDragEnd({ lng: event.lngLat.lng, lat: event.lngLat.lat })
          : undefined
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={cn(
          // Markers aren't clickable yet, so never show the pointer cursor:
          // static and draggable markers both use the grab/hand cursor.
          'h-8 w-8 cursor-grab drop-shadow',
          draggable && 'active:cursor-grabbing',
        )}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId} cx="89.17%" cy="4.38%" r="91.78%">
            <stop offset="0%" stopColor="var(--op-functional-green-500)" />
            <stop offset="100%" stopColor="var(--op-brand-blue)" />
          </radialGradient>
        </defs>
        {/* Lucide map-pin copy/pasted to achieve faithful parity with design (circle coloration) */}
        <path
          d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
          fill={`url(#${gradientId})`}
        />
        <circle cx="12" cy="10" r="3" fill="white" />
      </svg>
    </Marker>
  );
}
