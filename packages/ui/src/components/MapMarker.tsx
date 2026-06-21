'use client';

import { useId } from 'react';
import {
  Marker,
  type MarkerDragEvent,
  type MarkerEvent,
} from 'react-map-gl/maplibre';

import { cn } from '../lib/utils';
import type { LngLat } from './Map';

export interface MapMarkerProps {
  longitude: number;
  latitude: number;
  /** Allow the user to drag the pin; fires `onDragEnd` on release. */
  draggable?: boolean;
  onDragEnd?: (lngLat: LngLat) => void;
  /**
   * Highlight the marker — coral gradient, enlarged, and raised above its
   * neighbours. Used to mirror the hovered/active proposal in a list+map view.
   */
  isActive?: boolean;
  /** Makes the marker clickable (pointer cursor); fires on click/tap. */
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * A map-pin marker for {@link Map}, anchored at its tip. Presentational only —
 * dragging reports the new coordinate through `onDragEnd`; the parent owns the
 * position and active state.
 *
 * The default pin uses Lucide's `map-pin` geometry filled with the brand
 * BlueGreen radial gradient (`Gradients/BlueGreen` — `bg-blueGreen`). The
 * active pin swaps in the brand Coral gradient (`bg-coralCoral`) and grows.
 */
export function MapMarker({
  longitude,
  latitude,
  draggable = false,
  onDragEnd,
  isActive = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
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
      // Lift the active pin above its neighbours so the enlarged head isn't
      // clipped by adjacent markers.
      style={isActive ? { zIndex: 1 } : undefined}
      onClick={
        onClick
          ? (event: MarkerEvent<MouseEvent>) => {
              // Don't let the click fall through to the map below.
              event.originalEvent.stopPropagation();
              onClick();
            }
          : undefined
      }
      onDragEnd={
        onDragEnd
          ? (event: MarkerDragEvent) =>
              onDragEnd({ lng: event.lngLat.lng, lat: event.lngLat.lat })
          : undefined
      }
    >
      {/* Wrapper carries the hover handlers; the Marker owns positioning. */}
      <span
        className="block"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn(
            'drop-shadow transition-all duration-150',
            isActive ? 'h-10 w-10' : 'h-8 w-8',
            // Clickable markers get the pointer; otherwise keep the grab/hand
            // cursor used by static and draggable pins.
            onClick ? 'cursor-pointer' : 'cursor-grab',
            draggable && 'active:cursor-grabbing',
          )}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={gradientId} cx="89.17%" cy="4.38%" r="91.78%">
              {isActive ? (
                <>
                  {/* Brand Coral gradient (`bg-coralCoral`). */}
                  <stop offset="0%" stopColor="#DD2D1E" />
                  <stop offset="100%" stopColor="#DB862A" />
                </>
              ) : (
                <>
                  <stop
                    offset="0%"
                    stopColor="var(--op-functional-green-500)"
                  />
                  <stop offset="100%" stopColor="var(--op-brand-blue)" />
                </>
              )}
            </radialGradient>
          </defs>
          {/* Lucide map-pin copy/pasted to achieve faithful parity with design (circle coloration) */}
          <path
            d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
            fill={`url(#${gradientId})`}
          />
          <circle cx="12" cy="10" r="3" fill="white" />
        </svg>
      </span>
    </Marker>
  );
}
