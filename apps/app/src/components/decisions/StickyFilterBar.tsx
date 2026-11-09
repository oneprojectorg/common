'use client';

import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';

// Nearest scrollable ancestor — the IntersectionObserver root, so pin detection
// is measured against the content scroll container rather than the viewport.
export const getScrollParent = (node: Element | null): Element | null => {
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
  className?: string;
  children: ReactNode;
}

/**
 * The pinning shell shared by the decision list surfaces' filter bars. A
 * zero-height sentinel, observed against the nearest scroll container, flips
 * `data-pinned` exactly as the bar locks. The pin line is the container's
 * `--pin-offset` (0 when unset), read by CSS alone; once pinned, the full-bleed hairlines and white backing fade
 * in. Requires a `relative` ancestor for the sentinel to anchor to. Callers
 * supply the bar's content — typically a header on the left, filters on the
 * right (the shell lays them out with `justify-between`). A caller that needs a
 * different arrangement overrides it through `className`; the layout defaults
 * live here only because two of the three callers want them.
 */
export const StickyFilterBar = ({
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
        rootMargin: '0px',
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel one pin offset above the bar's natural top — absolute so it
          adds no space in the parent's flex `gap`. Anchors to the list's
          `relative` container. It leaves the container's top edge exactly when
          the bar's natural top passes the pin line, so the observer needs no
          rootMargin and stays correct at every breakpoint. Zero height: a 1px
          sentinel would still touch the edge for one more pixel of scroll. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="absolute start-0 -top-pin-offset h-0 w-px"
      />
      <div
        data-pinned={isPinned || undefined}
        className={cn(
          'group sticky top-pin-offset z-20 flex flex-wrap items-center justify-between gap-4 overflow-visible bg-white py-3 transition-shadow',
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
            content shows through the gutters when pinned). It also extends up
            by the pin offset, to back any chrome floating above the bar. Sits
            behind the bar's own content (-z-10) but above the scrolling content
            (the bar's z-20). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-pin-offset bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-white opacity-0 transition-opacity group-data-[pinned=true]:opacity-100"
        />
        {children}
      </div>
    </>
  );
};
