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
   * while the cursor is over the pin or the card itself. The card is portaled
   * to `document.body` so it can escape the map container's `overflow:hidden`
   * (otherwise pins near the edge would have their card clipped). It stays
   * glued to the pin during pan and hides as soon as the user starts zooming.
   * Pointer events on the card don't bubble to the marker's `onClick`.
   */
  hoverContent?: ReactNode;
  /**
   * Override the card's open state. When defined, the value is used directly
   * (the internal hover state machine is bypassed). Use this for touch
   * platforms where the card is shown/hidden by external state (e.g. a tap
   * sets an `activeId`, a second tap navigates).
   */
  isOpen?: boolean;
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
 * room above. The card is rendered in a sibling portal to `document.body`
 * so it can escape the map container's `overflow:hidden` clipping, and is
 * kept glued to the pin during pan / dismissed on zoom.
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
    controlledOpen: isOpen,
  });

  // The active pin (enlarged head) needs to sit above its neighbours so the
  // head isn't clipped. The hovercard is portaled outside the map so it
  // doesn't need its own lift here.
  const lifted = isActive;

  return (
    <>
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
 * Renders the hovercard in a portal mounted on `document.body` so it can
 * escape the map's `overflow:hidden` clipping (pins near the edge of the
 * map would otherwise have their card cut off). The card is `position:
 * fixed` to viewport coords computed from the pin's projection — the
 * parent hook recomputes the position on maplibre `move` (continuous
 * during pan) and on window `scroll` / `resize`, so the card tracks the
 * pin even as the sticky map's bounding rect shifts.
 *
 * Rendered as a SIBLING of the maplibre `Marker` (not a child) so the
 * Marker's createPortal-to-marker-DOM only ever receives the single
 * `<span>` child — multiple children inside the Marker's child slot was
 * the cause of the first portal regression.
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
  // SSR safety — `document` doesn't exist on the server. MapMarker is
  // `'use client'` and its consumers are loaded via `dynamic({ssr: false})`,
  // but this guard protects any future server caller too.
  if (typeof document === 'undefined') {
    return null;
  }
  if (!open || !position) {
    return null;
  }
  const isTop = placement === 'top';
  return createPortal(
    <div
      // Very high z-index so the card sits above the rest of the page
      // chrome. Matches the band used by the existing Popover component.
      className={cn(
        'fixed z-[9999]',
        isTop ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2',
      )}
      style={{
        left: position.x,
        top: isTop
          ? position.y - pinHeightPx - HOVERCARD_GAP_PX
          : position.y + HOVERCARD_GAP_PX,
      }}
      // The card is interactive (it opens the proposal on click), so we keep
      // pointer events on but stop propagation so a click on the card doesn't
      // fall through to the marker's onClick.
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
  /**
   * Externally-controlled open state. When defined, the hook treats this as
   * the source of truth (touch platforms use this to drive the card from
   * tap-state instead of mouseenter/mouseleave).
   */
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
 * State machine for a map pin's hovercard. Owns the open/close state, the
 * dismiss-delay timer (so the cursor can transit from pin to card without
 * the card snapping shut), the placement (above vs flipped below the pin),
 * the viewport-coord position used by the portal, and the zoom-dismiss
 * subscription.
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
  controlledOpen,
}: UseMapPinHovercardArgs): MapPinHovercardState {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  // When the consumer controls the card (touch flow), the prop wins; the
  // internal hover state machine still tracks for consistency but isn't the
  // source of truth for visibility.
  const isOpen = isControlled ? controlledOpen : internalIsOpen;
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [cardPosition, setCardPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Clear any pending dismiss when the consumer unmounts.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Dismiss the hovercard as soon as the user starts zooming. Pan is tracked
  // separately (the portal repositions continuously on `move`). When the open
  // state is externally controlled (touch flow), the consumer dismisses the
  // card itself — zoomstart only closes the uncontrolled hover-driven card.
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

  // While the card is open, keep its viewport-coord position glued to the
  // pin. We subscribe to maplibre `move` (continuous during pan) and to
  // window scroll/resize (the map sits inside a `sticky` aside on desktop —
  // the map's bounding rect moves with the page until sticky engages).
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
    setInternalIsOpen(true);
  };

  // Schedule a deferred close. The consumer's `onDeactivate` is delayed in
  // lockstep so the pin keeps its active state across the pin→card gap.
  const scheduleDismiss = () => {
    clearDismissTimer();
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
