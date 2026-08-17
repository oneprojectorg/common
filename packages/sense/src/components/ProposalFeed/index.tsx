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
 */
export function ProposalFeed({
  dimStrength = 0.6,
  centerFirstAndLast = true,
  children,
  className,
  ...rest
}: ProposalFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const scrollParent = findScrollParent(list);
    const scrollTarget: EventTarget = scrollParent ?? window;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;

    const update = () => {
      frame = 0;

      const containerRect = scrollParent?.getBoundingClientRect();
      const containerTop = containerRect?.top ?? 0;
      const containerHeight = containerRect?.height ?? window.innerHeight;
      const containerCenter = containerTop + containerHeight / 2;

      if (centerFirstAndLast) {
        // Runtime padding (30% of the container) lets the first and last
        // items reach the focal center instead of pinning to an edge.
        list.style.paddingBlock = `${Math.round(containerHeight * 0.3)}px`;
      }

      const items = list.querySelectorAll<HTMLLIElement>(
        ':scope > [data-slot=proposal-feed-item]',
      );

      let focal: HTMLLIElement | null = null;
      let focalDistance = Number.POSITIVE_INFINITY;

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - containerCenter);
        if (distance < focalDistance) {
          focalDistance = distance;
          focal = item;
        }
      }

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        // 0 at the focal center → 1 at half a container away.
        const t = Math.min(
          Math.abs(center - containerCenter) / (containerHeight / 2),
          1,
        );
        const isFocal = item === focal;
        // Keyboard focus inside an item always lifts the dim: low-contrast
        // text under the reader's focus is an a11y failure, not a nicety.
        const holdsFocus = item.contains(document.activeElement);
        const lifted = isFocal || holdsFocus;

        item.dataset.focal = lifted ? 'true' : 'false';
        item.style.opacity = lifted
          ? ''
          : String(1 - t * clampStrength(dimStrength));
        if (reducedMotion.matches) {
          item.style.transform = '';
        } else {
          item.style.transform = lifted ? '' : `scale(${1 - t * 0.02})`;
        }
      }
    };

    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };

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
  }, [dimStrength, centerFirstAndLast]);

  return (
    <ul
      ref={listRef}
      data-slot="proposal-feed"
      className={cn('mx-auto flex w-full max-w-3xl flex-col gap-6', className)}
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
      // scale values themselves come from the feed's scroll pass.
      className={cn(
        'transition-all duration-200 ease-out motion-reduce:transition-none',
        className,
      )}
      {...rest}
    />
  );
}

/** Nearest ancestor that actually scrolls vertically; null means the window. */
function findScrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function clampStrength(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
