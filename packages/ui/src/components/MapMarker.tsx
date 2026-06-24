'use client';

import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  /**
   * Optional hovercard rendered alongside the pin while {@link isActive} is
   * true. Lives inside the marker's DOM so it stays glued to the pin as the
   * map pans. Mouse events on the card bubble through the same handlers as
   * the pin, so the parent's debounced active-id machinery can keep the card
   * open while the cursor transits the gap between pin and card. Placement
   * flips to below the pin when there is not enough room above inside the
   * map container.
   */
  hoverCard?: ReactNode;
  /** Pixel gap between the pin and the hovercard. */
  hoverGap?: number;
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
  hoverCard,
  hoverGap = 12,
}: MapMarkerProps) {
  // Unique per instance so multiple markers on one page don't collide on the
  // gradient's `id` (referenced via `url(#…)`, which resolves by document id).
  const gradientId = useId();

  const pinRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Default to `top` so the first paint of the card is consistent with the
  // common case; the layout effect below flips it when the pin sits too close
  // to the top of the map. `useLayoutEffect` blocks paint, so a re-opened card
  // whose previous placement was `bottom` doesn't visibly flash before the
  // measurement runs on the new open.
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const hasHoverCard = hoverCard !== undefined && hoverCard !== null;

  // Recompute placement whenever the card opens. Reading the pin's bounding
  // rect once per open is enough: the marker is anchored to a fixed lng/lat,
  // so its viewport offset only changes on pan/zoom — and `onZoomStart` on
  // the map clears the active state before a zoom can finish. `hasHoverCard`
  // (a boolean) is used instead of the raw `hoverCard` JSX so this effect
  // doesn't re-run on every parent render that happens to produce a new card
  // identity.
  useLayoutEffect(() => {
    if (!isActive || !hasHoverCard) {
      return;
    }
    const pin = pinRef.current;
    const card = cardRef.current;
    if (!pin) {
      return;
    }

    const pinRect = pin.getBoundingClientRect();
    const mapEl = pin.closest('.maplibregl-map');
    if (!mapEl) {
      return;
    }
    const mapRect = mapEl.getBoundingClientRect();
    // Fall back to a sensible default when the card hasn't measured yet
    // (first render). Once measured we use the live height.
    const cardHeight = card?.getBoundingClientRect().height ?? 160;

    if (pinRect.top - cardHeight - hoverGap < mapRect.top) {
      setPlacement('bottom');
    } else {
      setPlacement('top');
    }
  }, [isActive, hasHoverCard, hoverGap]);

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      draggable={draggable}
      // Lift the active pin (and its hovercard) above its neighbours so the
      // enlarged head and card aren't clipped by adjacent markers.
      style={isActive ? { zIndex: 1 } : undefined}
      onClick={
        onClick
          ? (event: MarkerEvent<MouseEvent>) => {
              // Clicks anywhere inside the marker (pin or hovercard) bubble
              // through maplibre's marker listener. The hovercard owns its
              // own click target (a Next `Link`); swallowing the native
              // event here would block React from delegating to the Link's
              // onClick, which would in turn fall back to the browser
              // following the bare `<a href>` — a full page reload.
              // `target` is typed Element in spec but is sometimes a text
              // Node in practice (e.g. Firefox firing click on text inside
              // the card's label). `Node.contains` accepts any Node, so we
              // only need to confirm it IS a Node before checking ancestry.
              const target = event.originalEvent.target;
              if (target instanceof Node && cardRef.current?.contains(target)) {
                return;
              }
              // Don't let pin clicks fall through to the map below.
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
        ref={pinRef}
        className="relative block"
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
        {hoverCard && isActive && (
          <div
            ref={cardRef}
            // Position relative to the pin's wrapper so the maplibre transform
            // that keeps the pin glued to a lng/lat also moves the card. The
            // card sits horizontally centered over the pin head and offset
            // vertically by `hoverGap` from the corresponding edge.
            className={cn(
              'absolute left-1/2 z-10 -translate-x-1/2',
              placement === 'top' ? 'bottom-full' : 'top-full',
            )}
            style={
              placement === 'top'
                ? { marginBottom: hoverGap }
                : { marginTop: hoverGap }
            }
            // The card lives outside the pin's bounding rect, so hovering it
            // would fire the pin wrapper's mouseleave without these handlers.
            // Re-emitting the same events keeps the parent-side debounce alive
            // while the cursor is anywhere over the card.
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            {hoverCard}
          </div>
        )}
      </span>
    </Marker>
  );
}
