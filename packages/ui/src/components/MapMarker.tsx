'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  Marker,
  type MarkerDragEvent,
  type MarkerEvent,
  type MapRef,
  useMap,
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
   * Optional hovercard rendered above (or below, if near the top edge) the pin
   * while the cursor is over the pin or the card itself. The card stays glued
   * to the pin on pan (it's nested in the same MapLibre `Marker`) and hides as
   * soon as the user starts zooming. Pointer events on the card don't bubble
   * to the marker's `onClick`.
   */
  hoverContent?: ReactNode;
}

/** Visual gap between the pin head and the hovercard, in CSS pixels. */
const HOVERCARD_GAP_PX = 8;
/**
 * Conservative height estimate used to decide whether the card fits above the
 * pin without a two-pass measure. Slightly larger than the typical card (so a
 * card that comes in a touch taller still gets flipped correctly).
 */
const HOVERCARD_ESTIMATED_HEIGHT_PX = 140;
/** Min breathing room kept between the card and the map's top/bottom edge. */
const HOVERCARD_EDGE_BUFFER_PX = 8;
/**
 * How long after the cursor leaves the pin (or card) we wait before dismissing
 * — long enough for the user to move from pin to card without the card
 * snapping shut on the transit.
 */
const HOVERCARD_DISMISS_DELAY_MS = 120;

/**
 * Decide whether the pin's hovercard should render above or below the pin.
 *
 * Above is the design default; we only flip below when the card wouldn't fit
 * above the pin's head (with `bufferPx` of breathing room) AND there's room
 * below the pin tip. In an extremely cramped map (neither fits), we fall back
 * to above — overflowing the top is preferable to obscuring the pin itself.
 */
export function getMapPinHovercardPlacement({
  pinHeadTopPx,
  pinTipPx,
  cardHeightPx,
  mapHeightPx,
  gapPx = HOVERCARD_GAP_PX,
  bufferPx = HOVERCARD_EDGE_BUFFER_PX,
}: {
  /** Top edge of the visible pin head, in map-container CSS pixels. */
  pinHeadTopPx: number;
  /** Y coord of the pin tip (the lng/lat), in map-container CSS pixels. */
  pinTipPx: number;
  /** Measured (or estimated) card height in CSS pixels. */
  cardHeightPx: number;
  /** Height of the map container in CSS pixels. */
  mapHeightPx: number;
  /** Gap between pin and card. Defaults to the visual gap constant. */
  gapPx?: number;
  /** Min buffer kept to the map edge. Defaults to the edge-buffer constant. */
  bufferPx?: number;
}): 'top' | 'bottom' {
  const fitsAbove = pinHeadTopPx - gapPx - cardHeightPx >= bufferPx;
  if (fitsAbove) {
    return 'top';
  }
  const fitsBelow = pinTipPx + gapPx + cardHeightPx <= mapHeightPx - bufferPx;
  if (fitsBelow) {
    return 'bottom';
  }
  return 'top';
}

/**
 * A map-pin marker for {@link Map}, anchored at its tip. Presentational only —
 * dragging reports the new coordinate through `onDragEnd`; the parent owns the
 * position and active state.
 *
 * The default pin uses Lucide's `map-pin` geometry filled with the brand
 * BlueGreen radial gradient (`Gradients/BlueGreen` — `bg-blueGreen`). The
 * active pin swaps in the brand Coral gradient (`bg-coralCoral`) and grows.
 *
 * When `hoverContent` is provided, hovering the pin (or the card itself)
 * opens a hovercard above the pin — flipped below when there isn't enough
 * room above, glued to the pin on pan (same Marker subtree), and dismissed
 * as soon as the user starts zooming.
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
  hoverContent,
}: MapMarkerProps) {
  // Unique per instance so multiple markers on one page don't collide on the
  // gradient's `id` (referenced via `url(#…)`, which resolves by document id).
  const gradientId = useId();
  const pinHeightPx = isActive ? 40 : 32;
  const { current: map } = useMap();
  const hovercard = useMapPinHovercard({
    map,
    enabled: Boolean(hoverContent),
    longitude,
    latitude,
    pinHeightPx,
    onActivate: onMouseEnter,
    onDeactivate: onMouseLeave,
  });

  // The active pin (enlarged head) needs to sit above its neighbours so the
  // head isn't clipped. An open hovercard needs the same lift so the card
  // isn't clipped by adjacent pins — even when the pin itself isn't active
  // (e.g. a consumer that supplies `hoverContent` but no hover callbacks).
  const lifted = isActive || hovercard.isOpen;

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      draggable={draggable}
      style={lifted ? { zIndex: 1 } : undefined}
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
      <span
        // Wrapper carries the hover handlers; the Marker owns positioning.
        // `position: relative` anchors the hovercard's absolute positioning
        // to the pin head.
        className="relative block"
        onMouseEnter={hovercard.onPinEnter}
        onMouseLeave={hovercard.onPinLeave}
      >
        <MapPinSvg
          gradientId={gradientId}
          isActive={isActive}
          clickable={Boolean(onClick)}
          draggable={draggable}
        />
        {hoverContent && hovercard.isOpen && (
          <div
            // `bottom: 100%` for the top placement anchors the card's bottom
            // edge above the pin head; `top: 100%` flips it below. `left:
            // 50%` + `translate-x-[-50%]` centers the card on the pin tip.
            className={cn(
              'absolute left-1/2 -translate-x-1/2',
              hovercard.placement === 'top'
                ? 'bottom-full mb-2'
                : 'top-full mt-2',
            )}
            // The card is interactive (it opens the proposal on click), so we
            // keep pointer events on but stop propagation so a click on the
            // card doesn't fall through to the marker's onClick.
            onMouseEnter={hovercard.onCardEnter}
            onMouseLeave={hovercard.onCardLeave}
            onClick={(event) => event.stopPropagation()}
          >
            {hoverContent}
          </div>
        )}
      </span>
    </Marker>
  );
}

interface MapPinSvgProps {
  gradientId: string;
  isActive: boolean;
  clickable: boolean;
  draggable: boolean;
}

function MapPinSvg({
  gradientId,
  isActive,
  clickable,
  draggable,
}: MapPinSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        'drop-shadow transition-all duration-150',
        isActive ? 'h-10 w-10' : 'h-8 w-8',
        // Clickable markers get the pointer; otherwise keep the grab/hand
        // cursor used by static and draggable pins.
        clickable ? 'cursor-pointer' : 'cursor-grab',
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
              <stop offset="0%" stopColor="var(--op-functional-green-500)" />
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
  );
}

interface UseMapPinHovercardArgs {
  map: MapRef | undefined;
  enabled: boolean;
  longitude: number;
  latitude: number;
  pinHeightPx: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

interface MapPinHovercardState {
  isOpen: boolean;
  placement: 'top' | 'bottom';
  onPinEnter: () => void;
  onPinLeave: () => void;
  onCardEnter: () => void;
  onCardLeave: () => void;
}

/**
 * State machine for a map pin's hovercard. Owns the open/close state, the
 * dismiss-delay timer (so the cursor can transit from pin to card without
 * the card snapping shut), the placement (above vs flipped below the pin),
 * and the zoom-dismiss subscription.
 *
 * `onActivate` / `onDeactivate` are the consumer's hover callbacks — they
 * fire on the same edges as `isOpen` toggling, so the marker's active state
 * stays in lockstep with the hovercard's open state (including across the
 * dismiss delay, so the pin doesn't flicker out of "active" mid-transit).
 *
 * When `enabled` is false, the hook degrades to a thin pass-through that
 * calls `onActivate` / `onDeactivate` synchronously and never opens a card.
 */
function useMapPinHovercard({
  map,
  enabled,
  longitude,
  latitude,
  pinHeightPx,
  onActivate,
  onDeactivate,
}: UseMapPinHovercardArgs): MapPinHovercardState {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  // Clear any pending dismiss when the consumer unmounts.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Dismiss the hovercard as soon as the user starts zooming. Pan is left
  // alone — the card is nested in the Marker, so it tracks the pin naturally.
  useEffect(() => {
    if (!enabled || !map) {
      return;
    }
    const close = () => setIsOpen(false);
    map.on('zoomstart', close);
    return () => {
      map.off('zoomstart', close);
    };
  }, [enabled, map]);

  // Recompute placement when the card opens or the camera settles. A
  // conservative height estimate avoids a two-pass measure on first paint.
  useEffect(() => {
    if (!enabled || !isOpen || !map) {
      return;
    }
    const recompute = () => {
      const projected = map.project([longitude, latitude]);
      setPlacement(
        getMapPinHovercardPlacement({
          pinHeadTopPx: projected.y - pinHeightPx,
          pinTipPx: projected.y,
          cardHeightPx: HOVERCARD_ESTIMATED_HEIGHT_PX,
          mapHeightPx: map.getContainer().clientHeight,
        }),
      );
    };
    recompute();
    map.on('moveend', recompute);
    return () => {
      map.off('moveend', recompute);
    };
  }, [enabled, isOpen, map, longitude, latitude, pinHeightPx]);

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const open = () => {
    clearDismissTimer();
    setIsOpen(true);
  };

  // Schedule a deferred close. The consumer's `onDeactivate` is delayed in
  // lockstep so the pin keeps its active state across the pin→card gap.
  const scheduleDismiss = () => {
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      dismissTimerRef.current = null;
      onDeactivate?.();
    }, HOVERCARD_DISMISS_DELAY_MS);
  };

  return {
    isOpen,
    placement,
    onPinEnter: () => {
      onActivate?.();
      if (enabled) {
        open();
      }
    },
    onPinLeave: () => {
      if (enabled) {
        scheduleDismiss();
        return;
      }
      onDeactivate?.();
    },
    onCardEnter: open,
    onCardLeave: scheduleDismiss,
  };
}
