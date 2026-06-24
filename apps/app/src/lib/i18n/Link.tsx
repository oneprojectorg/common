'use client';

import { cn } from '@op/ui/utils';
import type { AnchorHTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';

import { useForesight } from '@/hooks/useForesight';

import { NavLink, useRouter } from './routing';

/**
 * App-wide `<Link>` wrapper around next-intl's navigation `Link`, implementing
 * the "Extending or ejecting Link" pattern from the Next.js prefetching guide
 * (https://nextjs.org/docs/app/guides/prefetching#extending-or-ejecting-link),
 * which explicitly recommends ForesightJS as the prediction backend.
 *
 * We set `prefetch={false}` on the underlying next-intl `<Link>` so Next.js'
 * default viewport-eager scheduler stays out of the way, then trigger
 * `router.prefetch(href, { onInvalidate })` from the foresight callback once
 * the predictor fires (mouse trajectory aimed at the link, keyboard tab N
 * stops away, scroll/touch on mobile). The `onInvalidate` re-prefetches when
 * Next.js suspects the cached payload has gone stale, keeping the warm cache
 * fresh for repeat hovers without re-running the predictor.
 */
export const Link = ({
  children,
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const router = useRouter();
  const cancelledRef = useRef(false);

  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (!href || cancelledRef.current) {
        return;
      }
      const hrefStr = String(href);
      const refresh = () => {
        if (cancelledRef.current) {
          return;
        }
        // @ts-ignore — next-intl types `prefetch` against a route literal
        // union; our callers pass arbitrary string hrefs. The options arg
        // forwards through to next/navigation's router.prefetch.
        router.prefetch(hrefStr, { onInvalidate: refresh });
      };
      refresh();
    },
    name: typeof href === 'string' ? href : undefined,
  });

  // The `refresh` closure we hand to Next.js via `onInvalidate` outlives this
  // component — if we unmount before invalidation fires, we want re-prefetch
  // attempts to no-op. Re-arming on mount keeps the ref correct under
  // StrictMode's mount/unmount/mount cycle.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return (
    // @ts-ignore — next-intl's NavLink expects a route literal; we forward the
    // loose `AnchorHTMLAttributes` shape used across the app unchanged.
    <NavLink
      {...props}
      href={href}
      ref={elementRef}
      className={cn('hover:underline', className)}
      prefetch={false}
    >
      {children}
    </NavLink>
  );
};
