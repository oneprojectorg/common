'use client';

import { useForesight } from '@/hooks/useForesight';
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
    // No `hover:underline` here: base-ui concatenates className without merging,
    // so a Link passed as a `render` target fights the primitive it renders as
    // (a DropdownMenuLinkItem would underline on hover). Callers that want an
    // underline declare it — many already do.
    //
    // @ts-ignore — next-intl's NavLink expects a route literal; we forward
    // arbitrary string hrefs.
    <NavLink {...props} ref={elementRef} className={className} prefetch={false}>
      {children}
    </NavLink>
  );
};
