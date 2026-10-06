import { useForesight } from '@/hooks/useForesight';
import { useRouter } from '@tanstack/react-router';
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type Ref,
  useCallback,
} from 'react';
import { useLocale } from 'use-intl';

import { localizeHref } from './routing';

/**
 * An anchor for in-app links: adds the locale to app-absolute hrefs, navigates
 * client-side, and preloads the target when the pointer heads towards it
 * (ForesightJS). Anything else — a modified click, another target, an external
 * href — falls through to the browser.
 */
export const Link = ({
  children,
  className,
  ref,
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>;
}) => {
  const router = useRouter();
  const locale = useLocale();
  const localizedHref =
    href === undefined ? undefined : localizeHref(href, locale);
  // `//host/path` is protocol-relative: another site.
  const isInAppHref =
    localizedHref !== undefined &&
    localizedHref.startsWith('/') &&
    !localizedHref.startsWith('//');

  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (!localizedHref || !isInAppHref) {
        return;
      }

      void router
        .preloadRoute({ to: '.', href: localizedHref })
        .catch(() => {});
    },
    name: localizedHref,
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

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    const isPlainClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey;
    const opensHere = !props.target || props.target === '_self';

    if (
      event.defaultPrevented ||
      !localizedHref ||
      !isInAppHref ||
      !isPlainClick ||
      !opensHere ||
      props.download !== undefined
    ) {
      return;
    }

    event.preventDefault();
    void router.navigate({ to: '.', href: localizedHref });
  };

  return (
    // No `hover:underline` here: base-ui concatenates className without merging,
    // so a Link passed as a `render` target fights the primitive it renders as
    // (a DropdownMenuLinkItem would underline on hover). Callers that want an
    // underline declare it — many already do.
    <a
      {...props}
      href={localizedHref}
      ref={setRef}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
};
