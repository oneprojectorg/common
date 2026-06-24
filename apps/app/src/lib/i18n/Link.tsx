'use client';

import { useForesight } from '@/hooks/useForesight';
import { cn } from '@op/ui/utils';
import type { AnchorHTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';

import { NavLink, useRouter } from './routing';

// ForesightJS-driven prefetch per
// https://nextjs.org/docs/app/guides/prefetching#extending-or-ejecting-link.
export const Link = ({
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const router = useRouter();
  const cancelledRef = useRef(false);
  const { href } = props;

  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (!href || cancelledRef.current) {
        return;
      }
      const hrefStr = String(href);
      // Recursive onInvalidate keeps the warmed prefetch fresh until unmount.
      const refresh = () => {
        if (cancelledRef.current) {
          return;
        }
        // @ts-ignore — next-intl types prefetch against a route literal union.
        router.prefetch(hrefStr, { onInvalidate: refresh });
      };
      refresh();
    },
    name: typeof href === 'string' ? href : undefined,
  });

  // Cancel pending onInvalidate callbacks once the link is gone.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return (
    // @ts-ignore — next-intl's NavLink expects a route literal; we forward
    // arbitrary string hrefs.
    <NavLink
      {...props}
      ref={elementRef}
      className={cn('hover:underline', className)}
      prefetch={false}
    >
      {children}
    </NavLink>
  );
};
