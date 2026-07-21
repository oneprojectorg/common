'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Marker,
  type MarkerDragEvent,
  type MarkerEvent,
  type MapRef,
  useMap,
} from 'react-map-gl/maplibre';

import { cn } from '../../lib/utils';
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
   * Hovercard rendered above the pin while it (or the card) is hovered.
   * Portaled to `document.body` so it can escape the map's `overflow:hidden`;
   * stays glued to the pin during pan and hides on zoom.
   */
  hoverContent?: ReactNode;
  /**
   * Controlled open state. When defined, bypasses the internal hover state
   * machine — used by touch platforms where the card is driven by tap state.
   */
  isOpen?: boolean;
}

const HOVERCARD_GAP_PX = 8;
/** Conservative estimate so placement can decide without a two-pass measure. */
const HOVERCARD_ESTIMATED_HEIGHT_PX = 140;
const HOVERCARD_EDGE_BUFFER_PX = 8;
/** Long enough for the cursor to transit from pin to card without dismissing. */
const HOVERCARD_DISMISS_DELAY_MS = 120;

/**
 * Decide whether the pin's hovercard renders above (default) or flipped below.
 * Flips below only when the card wouldn't fit above the pin head; falls back
 * to above when neither side fits (overflow beats obscuring the pin).
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
  cardHeightPx: number;
  mapHeightPx: number;
  gapPx?: number;
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
 * position and active state. The active pin swaps to a coral gradient and
 * grows; otherwise it uses the brand BlueGreen gradient.
 *
 * When `hoverContent` is provided, hovering the pin opens a hovercard above
 * it (flipped below near the top edge). The card is portaled to `document.body`
 * so it can escape the map's `overflow:hidden`.
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
  isOpen,
}: MapMarkerProps) {
  // Per-instance so multiple markers don't collide on the gradient's `id`
  // (referenced via `url(#…)`, which resolves by document id).
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
    controlledOpen: isOpen,
  });

  return (
    <>
      <Marker
        longitude={longitude}
        latitude={latitude}
        anchor="bottom"
        draggable={draggable}
        // Lift the active pin above its neighbours so the enlarged head
        // isn't clipped. The hovercard is portaled so it doesn't need a lift.
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
        <span
          className="block"
          onMouseEnter={hovercard.onPinEnter}
          onMouseLeave={hovercard.onPinLeave}
        >
          <MapPinSvg
            gradientId={gradientId}
            isActive={isActive}
            clickable={Boolean(onClick)}
            draggable={draggable}
          />
        </span>
      </Marker>
      <MapPinHovercardPortal
        open={Boolean(hoverContent) && hovercard.isOpen}
        position={hovercard.cardPosition}
        placement={hovercard.placement}
        pinHeightPx={pinHeightPx}
        onMouseEnter={hovercard.onCardEnter}
        onMouseLeave={hovercard.onCardLeave}
      >
        {hoverContent}
      </MapPinHovercardPortal>
    </>
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
        clickable ? 'cursor-pointer' : 'cursor-grab',
        draggable && 'active:cursor-grabbing',
      )}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradientId} cx="89.17%" cy="4.38%" r="91.78%">
          {isActive ? (
            <>
              <stop offset="0%" stopColor="#DD2D1E" />
              <stop offset="100%" stopColor="#DB862A" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="var(--success)" />
              <stop offset="100%" stopColor="var(--color-blue-500)" />
            </>
          )}
        </radialGradient>
      </defs>
      {/* Lucide map-pin geometry, inlined to match the design exactly. */}
      <path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        fill={`url(#${gradientId})`}
      />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  );
}

interface MapPinHovercardPortalProps {
  open: boolean;
  position: { x: number; y: number } | null;
  placement: 'top' | 'bottom';
  pinHeightPx: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

/**
 * Hovercard portal mounted on `document.body` so it can escape the map's
 * `overflow:hidden`. `position: fixed` to viewport coords from the parent
 * hook (recomputed on pan / scroll / resize). Rendered as a SIBLING of the
 * maplibre `Marker` — a child would confuse the Marker's single-child slot.
 */
function MapPinHovercardPortal({
  open,
  position,
  placement,
  pinHeightPx,
  onMouseEnter,
  onMouseLeave,
  children,
}: MapPinHovercardPortalProps) {
  if (typeof document === 'undefined') {
    return null;
  }
  if (!open || !position) {
    return null;
  }
  const isTop = placement === 'top';
  // Portals to document.body, outside any `.sense` wrapper — re-scope so
  // hovercard content resolves sense tokens.
  return createPortal(
    <div
      className={cn(
        'sense fixed z-[9999]',
        isTop ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2',
      )}
      style={{
        left: position.x,
        top: isTop
          ? position.y - pinHeightPx - HOVERCARD_GAP_PX
          : position.y + HOVERCARD_GAP_PX,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // Stop a click on the card from falling through to the marker's onClick.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
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
  /** When defined, overrides the internal hover state. Touch-flow uses this. */
  controlledOpen?: boolean;
}

interface MapPinHovercardState {
  isOpen: boolean;
  placement: 'top' | 'bottom';
  cardPosition: { x: number; y: number } | null;
  onPinEnter: () => void;
  onPinLeave: () => void;
  onCardEnter: () => void;
  onCardLeave: () => void;
}

/**
 * State machine for a map pin's hovercard: open/close + dismiss-delay timer
 * (so the cursor can transit pin→card), above/below placement, viewport
 * position for the portal, and the zoom-dismiss subscription.
 *
 * `onActivate` / `onDeactivate` fire on the same edges as `isOpen` toggles,
 * with the deactivate delayed in lockstep so the pin stays active during
 * the pin→card gap. When `enabled` is false the hook is a thin pass-through
 * (no card, callbacks fire synchronously).
 */
function useMapPinHovercard({
  map,
  enabled,
  longitude,
  latitude,
  pinHeightPx,
  onActivate,
  onDeactivate,
  controlledOpen,
}: UseMapPinHovercardArgs): MapPinHovercardState {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  // Controlled prop wins; otherwise fall back to the internal hover state.
  const isOpen = controlledOpen ?? internalIsOpen;
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [cardPosition, setCardPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Clear any pending dismiss on unmount.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Dismiss the uncontrolled card when the user starts zooming. Controlled
  // mode lets the consumer handle dismiss.
  useEffect(() => {
    if (!enabled || !map || isControlled) {
      return;
    }
    const close = () => setInternalIsOpen(false);
    map.on('zoomstart', close);
    return () => {
      map.off('zoomstart', close);
    };
  }, [enabled, map, isControlled]);

  // Keep the portal's viewport position glued to the pin via maplibre `move`
  // (continuous pan) and window scroll/resize (the sticky aside shifts the
  // map's bounding rect until sticky engages).
  useEffect(() => {
    if (!enabled || !isOpen || !map) {
      return;
    }
    const updatePosition = () => {
      const projected = map.project([longitude, latitude]);
      const rect = map.getContainer().getBoundingClientRect();
      setCardPosition({
        x: rect.left + projected.x,
        y: rect.top + projected.y,
      });
      setPlacement(
        getMapPinHovercardPlacement({
          pinHeadTopPx: projected.y - pinHeightPx,
          pinTipPx: projected.y,
          cardHeightPx: HOVERCARD_ESTIMATED_HEIGHT_PX,
          mapHeightPx: map.getContainer().clientHeight,
        }),
      );
    };
    updatePosition();
    map.on('move', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      map.off('move', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
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
    if (isControlled) {
      return;
    }
    setInternalIsOpen(true);
  };

  // Deferred close — delays `onDeactivate` too so the pin stays active
  // across the pin→card gap.
  const scheduleDismiss = () => {
    clearDismissTimer();
    if (isControlled) {
      return;
    }
    dismissTimerRef.current = setTimeout(() => {
      setInternalIsOpen(false);
      dismissTimerRef.current = null;
      onDeactivate?.();
    }, HOVERCARD_DISMISS_DELAY_MS);
  };

  return {
    isOpen,
    placement,
    cardPosition,
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
