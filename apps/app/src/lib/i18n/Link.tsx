'use client';

import { cn } from '@op/ui/utils';
import type { AnchorHTMLAttributes } from 'react';

import { useForesight } from '@/hooks/useForesight';

import { NavLink, useRouter } from './routing';

/**
 * App-wide `<Link>` wrapper around next-intl's navigation `Link`.
 *
 * Prefetching is driven by ForesightJS instead of Next.js' default
 * viewport-eager prefetch. We register the rendered anchor with the singleton
 * ForesightManager and call `router.prefetch(href)` once the predictor fires
 * (mouse trajectory aimed at the link, keyboard tab N stops away, scroll
 * heading toward it on mobile). This trades the "prefetch every visible link"
 * default — wasteful on dense pages — for an intent-based trigger that only
 * runs when the user is likely to click.
 *
 * `prefetch={false}` is forwarded to next-intl so we don't double up on
 * Next.js' built-in prefetch alongside the foresight-triggered one.
 */
export const Link = ({
  children,
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const router = useRouter();
  const elementRef = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (!href) {
        return;
      }
      // next-intl's router.prefetch is the localized counterpart to Link's
      // prefetch — it resolves the active locale's route segment.
      // @ts-ignore — next-intl types `prefetch` against a route literal union;
      // our callers pass arbitrary string hrefs.
      router.prefetch(href);
    },
    name: href,
  });

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
