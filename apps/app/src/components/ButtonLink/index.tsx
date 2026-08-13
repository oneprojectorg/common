import { Button } from '@op/sense/Button';
import type { ComponentProps } from 'react';

import { Link } from '@/lib/i18n';

type ButtonLinkProps = Omit<
  ComponentProps<typeof Button>,
  'render' | 'nativeButton' | 'role'
> & {
  href: ComponentProps<typeof Link>['href'];
} & Pick<ComponentProps<typeof Link>, 'target' | 'rel' | 'download'>;

/**
 * A sense `Button` that renders as a locale-aware `Link` — the button-styled
 * anchor. Inherits every `Button` prop
 * (`variant`, `size`, `loading`, …); `href` plus the anchor props `target`,
 * `rel`, and `download` are forwarded to the i18n `Link`.
 *
 * This navigates, so it stays a link: `nativeButton={false}` tells base-ui the
 * rendered element isn't a `<button>` (it was warning, and putting an invalid
 * `type="button"` on the anchor), and `role={undefined}` drops the `role="button"`
 * base-ui swaps in — which would announce it as a button and take it out of the
 * screen reader's links list.
 */
export const ButtonLink = ({
  href,
  target,
  rel,
  download,
  ...props
}: ButtonLinkProps) => {
  return (
    <Button
      nativeButton={false}
      role={undefined}
      render={
        <Link href={href} target={target} rel={rel} download={download} />
      }
      {...props}
    />
  );
};
