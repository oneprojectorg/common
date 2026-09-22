'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils';

export interface ProposalFeedProps extends ComponentProps<'ul'> {
  /**
   * How strongly non-focal items dim as they leave the viewport center, from
   * 0 (no dimming) to 1 (transparent at the edges). Defaults to 0.6.
   */
  dimStrength?: number;
  /**
   * Pad the feed by 30% of the scroll container's height so the first and
   * last items can reach the center. Defaults to true.
   */
  centerFirstAndLast?: boolean;
  /** `ProposalFeedItem` children. */
  children: ReactNode;
}

const CENTER_PADDING_RATIO = 0.3;
const SETTLE_SCALE = 0.02;

/**
 * Single-column feed that reads proposals one at a time: the item nearest the
 * viewport center holds full opacity while the rest dim by distance. Purely
 * presentational — wrap each entry (typically a `ProposalCard`) in a
 * `ProposalFeedItem`.
 *
 * Dimming is visual only; screen readers read every item normally, and an
 * item holding keyboard focus is never dimmed. The centering padding is served
 * as `30cqh` before hydration, which matches the measured value exactly when
 * the scroll container sets `container-type: size`.
 */
export function ProposalFeed({
  dimStrength = 0.6,
  centerFirstAndLast = true,
  children,
  className,
  ...rest
}: ProposalFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);
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
    let appliedPadding: string | null = null;

    const update = () => {
      frame = 0;

      const { dimStrength, centerFirstAndLast } = optionsRef.current;
      const strength = clampStrength(dimStrength);
      const settle = reducedMotion.matches ? 0 : SETTLE_SCALE;
      const focusedItem = document.activeElement?.closest<HTMLLIElement>(
        '[data-slot=proposal-feed-item]',
      );

      // All layout reads happen before any style write to avoid reflow per item.
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
        measured.push({ item, t: Math.min(distance / halfHeight, 1) });
      }

      const padding = centerFirstAndLast
        ? `${Math.round(containerHeight * CENTER_PADDING_RATIO)}px`
        : '';
      if (padding !== appliedPadding) {
        list.style.paddingBlock = padding;
        appliedPadding = padding;
      }

      for (const { item, t } of measured) {
        const lifted = item === focal || item === focusedItem;
        const opacity = lifted ? '' : String(1 - t * strength);
        const transform =
          lifted || settle === 0 ? '' : `scale(${1 - t * settle})`;
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
    list.addEventListener('focusin', schedule);
    list.addEventListener('focusout', schedule);
    reducedMotion.addEventListener('change', schedule);
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
 * One entry in a `ProposalFeed`. Exposes `data-focal="true" | "false"` so
 * callers can style the focal state beyond the built-in dim.
 */
export function ProposalFeedItem({
  className,
  ...rest
}: ProposalFeedItemProps) {
  return (
    <li
      data-slot="proposal-feed-item"
      className={cn(
        '[contain-intrinsic-size:auto_16rem] [content-visibility:auto]',
        'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        className,
      )}
      {...rest}
    />
  );
}

/** Nearest vertical scroll container; null means the window. */
function findScrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    // Viewport scroll events fire on `document`, not on `html` or `body`.
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
