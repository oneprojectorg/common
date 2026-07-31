'use client';

import { useForesight } from '@/hooks/useForesight';
import { cn } from '@op/sense/lib/utils';
import type { AnchorHTMLAttributes } from 'react';

import { NavLink, useRouter } from './routing';

// ForesightJS-driven prefetch per
// https://nextjs.org/docs/app/guides/prefetching#extending-or-ejecting-link.
export const Link = ({
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const router = useRouter();
  const { href } = props;

  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (!href) {
        return;
      }
      // @ts-ignore — next-intl types prefetch against a route literal union.
      router.prefetch(href);
    },
    name: href,
  });

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
