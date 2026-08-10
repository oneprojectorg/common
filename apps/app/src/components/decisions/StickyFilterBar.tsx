'use client';

import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';

// Nearest scrollable ancestor — the IntersectionObserver root, so pin detection
// is measured against the content scroll container rather than the viewport.
const getScrollParent = (node: Element | null): Element | null => {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
};

export interface StickyFilterBarProps {
  /**
   * Px offset where the bar pins inside its scroll container — clears whatever
   * sticky chrome sits above it (e.g. the floating Overview/Current toggle).
   * Drives both the sticky `top` and the observer rootMargin. Defaults to 0.
   */
  pinOffset?: number;
  className?: string;
  children: ReactNode;
}

/**
 * The pinning shell shared by the decision list surfaces' filter bars. A
 * zero-height sentinel just above the bar, observed against the nearest scroll
 * container (rootMargin shrunk by `pinOffset`), flips `data-pinned` exactly as
 * the bar locks; once pinned, the full-bleed hairlines and white backing fade
 * in. Requires a `relative` ancestor for the sentinel to anchor to. Callers
 * supply the bar's content — typically a header on the left, filters on the
 * right (the shell lays them out with `justify-between`).
 */
export const StickyFilterBar = ({
  pinOffset = 0,
  className,
  children,
}: StickyFilterBarProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsPinned(!entry?.isIntersecting),
      {
        root: getScrollParent(sentinel),
        rootMargin: `-${pinOffset}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pinOffset]);

  return (
    <>
      {/* Sentinel at the bar's natural top — absolute so it adds no space in the
          parent's flex `gap`. Anchors to the list's `relative` container; once
          it passes the pin line (scroll container top, shrunk by pinOffset) the
          observer flips. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="absolute top-0 left-0 h-px w-px"
      />
      <div
        data-pinned={isPinned || undefined}
        style={{ top: pinOffset }}
        className={cn(
          // `top` (inline) only matters on mobile, where it clears the floating
          // toggle; on >=md the toggle is inline in the header, so pin flush at 0.
          'group sticky z-20 flex flex-wrap items-center justify-between gap-4 overflow-visible bg-white py-3 transition-shadow md:top-0!',
          // Top hairline fades in on pin — mobile only (>=md has no floating
          // toggle above the bar, so no top edge to delineate).
          "max-md:before:pointer-events-none max-md:before:absolute max-md:before:top-0 max-md:before:left-1/2 max-md:before:w-screen max-md:before:-translate-x-1/2 max-md:before:border-t max-md:before:border-border max-md:before:opacity-0 max-md:before:content-['']",
          'max-md:data-[pinned=true]:before:opacity-100',
          // Bottom hairline fades in on pin — all breakpoints.
          "after:pointer-events-none after:absolute after:-bottom-px after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-border after:opacity-0 after:content-['']",
          'data-[pinned=true]:after:opacity-100',
          className,
        )}
      >
        {/* Full-bleed white that fades in once pinned — covers the bar and its
            side gutters (the bar itself is content-width, so without this,
            content shows through the gutters when pinned). On mobile it also
            extends up by `pinOffset` to back the floating toggle; on >=md the
            bar pins flush so it starts at the bar top. Sits behind the bar's own
            content (-z-10) but above the scrolling content (the bar's z-20). */}
        <div
          aria-hidden
          style={{ top: -pinOffset }}
          className="pointer-events-none absolute bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-white opacity-0 transition-opacity group-data-[pinned=true]:opacity-100 md:top-0!"
        />
        {children}
      </div>
    </>
  );
};
