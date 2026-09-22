'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils';

export interface ProposalFeedProps extends ComponentProps<'ul'> {
  /**
   * How strongly non-focal items dim as they leave the viewport center,
   * from 0 (no dimming) to 1 (fully transparent at the edges). The floor
   * opacity is `1 - dimStrength`. Defaults to 0.6.
   */
  dimStrength?: number;
  /**
   * Pad the feed so the first and last items can reach the viewport center
   * and take focus. The padding is measured from the scroll container at
   * runtime (30% of its height). Defaults to true.
   */
  centerFirstAndLast?: boolean;
  /** `ProposalFeedItem` children. */
  children: ReactNode;
}

/** Fraction of the scroll container's height padded above and below the feed. */
const CENTER_PADDING_RATIO = 0.3;
/** Maximum scale reduction applied to the item furthest from the focal point. */
const SETTLE_SCALE = 0.02;

/**
 * Single-column reading feed for walking proposals one at a time — the "feed"
 * view that sits alongside the grid and map views of a proposal list. Items
 * scroll through a focal point at the viewport center: the nearest item reads
 * at full opacity while the rest dim by distance, so one proposal at a time
 * holds attention without hiding the ones around it.
 *
 * Purely presentational: wrap each entry (typically a `ProposalCard`) in a
 * `ProposalFeedItem`. The list owns no data, ordering, or navigation — the
 * caller renders items in whatever order the surrounding view already uses.
 *
 * Focus handling: dimming is visual only (screen readers read dimmed items
 * normally), and an item containing keyboard focus is always lifted to full
 * opacity so focused content is never low-contrast. The subtle settle scale
 * is dropped when the user prefers reduced motion.
 *
 * The centering padding is served as `30cqh` before hydration so the first
 * paint already sits where the measured value will land. Give the scroll
 * container `container-type: size` (Tailwind `[container-type:size]`) for that to
 * match exactly; without one the units fall back to the viewport, which is
 * correct when the window itself scrolls.
 */
export function ProposalFeed({
  dimStrength = 0.6,
  centerFirstAndLast = true,
  children,
  className,
  ...rest
}: ProposalFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // Options live in a ref so a prop change re-runs the scroll pass without
  // tearing down and re-registering every listener and observer.
  const optionsRef = useRef({ dimStrength, centerFirstAndLast });
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    optionsRef.current = { dimStrength, centerFirstAndLast };
    scheduleRef.current?.();
  }, [dimStrength, centerFirstAndLast]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const scrollParent = findScrollParent(list);
    const scrollTarget: EventTarget = scrollParent ?? window;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    // Last padding written to the list, so the write (which invalidates
    // layout) only happens when the container height actually changes.
    let appliedPadding: string | null = null;

    const update = () => {
      frame = 0;

      const { dimStrength, centerFirstAndLast } = optionsRef.current;
      const strength = clampStrength(dimStrength);
      const settle = reducedMotion.matches ? 0 : SETTLE_SCALE;
      // The item holding keyboard focus, resolved once rather than asking
      // every item whether it contains the active element.
      const focusedItem = document.activeElement?.closest<HTMLLIElement>(
        '[data-slot=proposal-feed-item]',
      );

      // Read phase: every layout query happens before any style write so the
      // browser lays out once per frame instead of once per item.
      const containerRect = scrollParent?.getBoundingClientRect();
      const containerTop = containerRect?.top ?? 0;
      const containerHeight = containerRect?.height ?? window.innerHeight;
      const containerCenter = containerTop + containerHeight / 2;
      const halfHeight = containerHeight / 2;

      const items = list.querySelectorAll<HTMLLIElement>(
        ':scope > [data-slot=proposal-feed-item]',
      );
      const measured: Array<{ item: HTMLLIElement; t: number }> = [];
      let focal: HTMLLIElement | null = null;
      let focalDistance = Number.POSITIVE_INFINITY;

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - containerCenter);
        if (distance < focalDistance) {
          focalDistance = distance;
          focal = item;
        }
        // 0 at the focal center → 1 at half a container away.
        measured.push({ item, t: Math.min(distance / halfHeight, 1) });
      }

      // Write phase.
      const padding = centerFirstAndLast
        ? `${Math.round(containerHeight * CENTER_PADDING_RATIO)}px`
        : '';
      if (padding !== appliedPadding) {
        list.style.paddingBlock = padding;
        appliedPadding = padding;
      }

      for (const { item, t } of measured) {
        // Keyboard focus inside an item always lifts the dim: low-contrast
        // text under the reader's focus is an a11y failure, not a nicety.
        const lifted = item === focal || item === focusedItem;
        const opacity = lifted ? '' : String(1 - t * strength);
        const transform =
          lifted || settle === 0 ? '' : `scale(${1 - t * settle})`;

        // Skip untouched items so a long feed only restyles what moved.
        const focalFlag = lifted ? 'true' : 'false';
        if (item.dataset.focal !== focalFlag) {
          item.dataset.focal = focalFlag;
        }
        if (item.style.opacity !== opacity) {
          item.style.opacity = opacity;
        }
        if (item.style.transform !== transform) {
          item.style.transform = transform;
        }
      }
    };

    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };
    scheduleRef.current = schedule;

    schedule();
    scrollTarget.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Focus changes re-run the pass so a focused item lifts immediately.
    list.addEventListener('focusin', schedule);
    list.addEventListener('focusout', schedule);
    reducedMotion.addEventListener('change', schedule);
    // Content growth (infinite scroll appending items) shifts every center.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(list);

    return () => {
      scheduleRef.current = null;
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      scrollTarget.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      list.removeEventListener('focusin', schedule);
      list.removeEventListener('focusout', schedule);
      reducedMotion.removeEventListener('change', schedule);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <ul
      ref={listRef}
      data-slot="proposal-feed"
      className={cn(
        'mx-auto flex w-full max-w-3xl flex-col gap-6',
        // Pre-hydration stand-in for the measured centering padding; the
        // scroll pass replaces it with the exact pixel value.
        centerFirstAndLast && 'py-[30cqh]',
        className,
      )}
      {...rest}
    >
      {children}
    </ul>
  );
}

export type ProposalFeedItemProps = ComponentProps<'li'>;

/**
 * One entry in a `ProposalFeed`. Exposes `data-focal="true" | "false"` while
 * scrolling so callers can style the focal state beyond the built-in dim.
 */
export function ProposalFeedItem({
  className,
  ...rest
}: ProposalFeedItemProps) {
  return (
    <li
      data-slot="proposal-feed-item"
      // The transition eases the dim as the focal item changes; opacity and
      // scale values themselves come from the feed's scroll pass. Off-screen
      // items skip layout and paint until they approach the viewport; `auto`
      // remembers each card's rendered height so the scrollbar stays stable.
      className={cn(
        '[contain-intrinsic-size:auto_16rem] [content-visibility:auto]',
        'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Nearest ancestor that is a vertical scroll container; null means the window.
 * Overflow alone decides it: a container that is empty or still loading at
 * mount is not yet taller than its content, but it is where scrolling will
 * happen once the feed fills.
 */
function findScrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    // Viewport scrolling reports on `document`, not on `html` or `body`, even
    // when a stylesheet sets overflow on them; treat both as the window.
    if (parent === document.body || parent === document.documentElement) {
      return null;
    }
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function clampStrength(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
