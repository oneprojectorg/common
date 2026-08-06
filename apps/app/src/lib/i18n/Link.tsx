'use client';

import { useForesight } from '@/hooks/useForesight';
import { type AnchorHTMLAttributes, type Ref, useCallback } from 'react';

import { NavLink, useRouter } from './routing';

// ForesightJS-driven prefetch per
// https://nextjs.org/docs/app/guides/prefetching#extending-or-ejecting-link.
export const Link = ({
  children,
  className,
  ref,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>;
}) => {
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

  // Two owners need this node: Foresight, to watch it for prefetch, and any
  // caller passing this Link to a `render` prop. Keeping only Foresight's ref
  // left base-ui unable to focus the element, so a DropdownMenuLinkItem never
  // highlighted on hover and keyboard nav skipped it.
  const setRef = useCallback(
    (node: HTMLAnchorElement | null) => {
      elementRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [elementRef, ref],
  );

  return (
    // No `hover:underline` here: base-ui concatenates className without merging,
    // so a Link passed as a `render` target fights the primitive it renders as
    // (a DropdownMenuLinkItem would underline on hover). Callers that want an
    // underline declare it — many already do.
    //
    // @ts-ignore — next-intl's NavLink expects a route literal; we forward
    // arbitrary string hrefs.
    <NavLink {...props} ref={setRef} className={className} prefetch={false}>
      {children}
    </NavLink>
  );
};
