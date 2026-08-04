'use client';

import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
   * Hovercard rendered next to the pin while it (or the card) is hovered.
   * Uses the sense hovercard primitive (base-ui `PreviewCard`) so placement is
   * collision-aware — it flips above/below and shifts horizontally to stay on
   * screen near an edge. Portaled to `document.body` so it escapes the map's
   * `overflow:hidden`, and kept glued to the pin during pan via a virtual
   * anchor fed from the projected marker position.
   */
  hoverContent?: ReactNode;
  /**
   * Controlled open state. When defined, bypasses the internal hover state
   * machine — used by touch platforms where the card is driven by tap state.
   */
  isOpen?: boolean;
}

/** Gap between the pin and the card — base-ui `sideOffset`. */
const HOVERCARD_GAP_PX = 8;
/** Keep-on-screen inset for base-ui collision (flip + shift). */
const HOVERCARD_EDGE_BUFFER_PX = 8;
/** Long enough for the cursor to transit from pin to card without dismissing. */
const HOVERCARD_DISMISS_DELAY_MS = 120;

/**
 * A map-pin marker for {@link Map}, anchored at its tip. Presentational only —
 * dragging reports the new coordinate through `onDragEnd`; the parent owns the
 * position and active state. The active pin swaps to a coral gradient and
 * grows; otherwise it uses the brand BlueGreen gradient.
 *
 * When `hoverContent` is provided, hovering the pin opens a hovercard beside
 * it. Placement is collision-aware (base-ui `PreviewCard`): it prefers above
 * the pin, flips below near the top edge, and shifts horizontally so it never
 * clips off the left/right edge.
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
      <MapPinHovercard
        open={Boolean(hoverContent) && hovercard.isOpen}
        position={hovercard.cardPosition}
        pinHeightPx={pinHeightPx}
        onDismiss={hovercard.onCardLeave}
        onMouseEnter={hovercard.onCardEnter}
        onMouseLeave={hovercard.onCardLeave}
      >
        {hoverContent}
      </MapPinHovercard>
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

interface MapPinHovercardProps {
  open: boolean;
  /** Pin-tip position in viewport (fixed) coords, from the projected marker. */
  position: { x: number; y: number } | null;
  pinHeightPx: number;
  /** Called when base-ui wants to close (e.g. Escape) so the parent can dismiss. */
  onDismiss: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

/**
 * The pin's hovercard, built on the sense hovercard primitive (base-ui
 * `PreviewCard`). Open state is fully controlled by the marker's hover/tap
 * machine; there is no `Trigger` — the card anchors to a VIRTUAL element at
 * the pin's projected screen box, so base-ui's collision middleware flips it
 * above/below and shifts it horizontally to stay on screen. The virtual anchor
 * is rebuilt whenever `position` changes (the marker projection updates on map
 * `move`), which keeps the card glued to the pin during pan. Portaled to
 * `document.body`; the `sense` class re-scopes tokens outside the `.sense` root.
 */
function MapPinHovercard({
  open,
  position,
  pinHeightPx,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
  children,
}: MapPinHovercardProps) {
  // A zero-work virtual anchor describing the pin's box (tip at `position`,
  // head `pinHeightPx` above it), so base-ui positions relative to the pin.
  const anchor = useMemo(() => {
    if (!position) {
      return null;
    }
    const halfWidth = pinHeightPx / 2;
    const rect: DOMRect = {
      x: position.x - halfWidth,
      y: position.y - pinHeightPx,
      left: position.x - halfWidth,
      top: position.y - pinHeightPx,
      right: position.x + halfWidth,
      bottom: position.y,
      width: pinHeightPx,
      height: pinHeightPx,
      toJSON() {
        return this;
      },
    };
    return { getBoundingClientRect: () => rect };
  }, [position, pinHeightPx]);

  if (typeof document === 'undefined' || !open || !anchor) {
    return null;
  }

  return (
    <PreviewCardPrimitive.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onDismiss();
        }
      }}
    >
      <PreviewCardPrimitive.Portal>
        <PreviewCardPrimitive.Positioner
          anchor={anchor}
          side="top"
          align="center"
          sideOffset={HOVERCARD_GAP_PX}
          collisionPadding={HOVERCARD_EDGE_BUFFER_PX}
          // Portals outside any `.sense` wrapper — re-scope so the card content
          // resolves sense tokens. High z so it clears map chrome.
          className="sense isolate z-[9999]"
        >
          <PreviewCardPrimitive.Popup
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            // Stop a click on the card from falling through to the marker.
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </PreviewCardPrimitive.Popup>
        </PreviewCardPrimitive.Positioner>
      </PreviewCardPrimitive.Portal>
    </PreviewCardPrimitive.Root>
  );
}

interface UseMapPinHovercardArgs {
  map: MapRef | undefined;
  enabled: boolean;
  longitude: number;
  latitude: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
  /** When defined, overrides the internal hover state. Touch-flow uses this. */
  controlledOpen?: boolean;
}

interface MapPinHovercardState {
  isOpen: boolean;
  cardPosition: { x: number; y: number } | null;
  onPinEnter: () => void;
  onPinLeave: () => void;
  onCardEnter: () => void;
  onCardLeave: () => void;
}

/**
 * State machine for a map pin's hovercard: open/close + dismiss-delay timer
 * (so the cursor can transit pin→card), the pin's viewport position for the
 * card's virtual anchor, and the zoom-dismiss subscription.
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
  onActivate,
  onDeactivate,
  controlledOpen,
}: UseMapPinHovercardArgs): MapPinHovercardState {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  // Controlled prop wins; otherwise fall back to the internal hover state.
  const isOpen = controlledOpen ?? internalIsOpen;
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

  // Keep the card's virtual anchor glued to the pin: reproject on maplibre
  // `move` (continuous pan) and on window scroll/resize (the sticky aside
  // shifts the map's bounding rect until sticky engages). Each update sets a
  // fresh `cardPosition`, which rebuilds the anchor so base-ui repositions.
  useEffect(() => {
    if (!enabled || !isOpen || !map) {
      return;
    }

    let frame: number | null = null;

    const reposition = () => {
      frame = null;
      const projected = map.project([longitude, latitude]);
      const rect = map.getContainer().getBoundingClientRect();
      setCardPosition({
        x: rect.left + projected.x,
        y: rect.top + projected.y,
      });
    };

    // Coalesce bursts of move/scroll/resize into at most one reposition per
    // frame — the handlers only book a frame; `reposition` does the work.
    const schedule = () => {
      if (frame === null) {
        frame = requestAnimationFrame(reposition);
      }
    };

    reposition(); // position immediately on open (no first-frame flash)
    map.on('move', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      map.off('move', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, isOpen, map, longitude, latitude]);

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
    // Fire `onDeactivate` on leave in both modes — only the internal open
    // state is skipped when controlled. Otherwise a controlled consumer using
    // `onMouseLeave` never learns the cursor left and stays stuck active.
    dismissTimerRef.current = setTimeout(() => {
      if (!isControlled) {
        setInternalIsOpen(false);
      }
      dismissTimerRef.current = null;
      onDeactivate?.();
    }, HOVERCARD_DISMISS_DELAY_MS);
  };

  return {
    isOpen,
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
