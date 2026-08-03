import { Button } from '@op/sense/Button';
import type { ComponentProps } from 'react';

import { Link } from '@/lib/i18n';

type ButtonLinkProps = Omit<ComponentProps<typeof Button>, 'render'> & {
  href: ComponentProps<typeof Link>['href'];
} & Pick<ComponentProps<typeof Link>, 'target' | 'rel' | 'download'>;

/**
 * A sense `Button` that renders as a locale-aware `Link` — the button-styled
 * anchor (replaces `@op/ui`'s `ButtonLink`). Inherits every `Button` prop
 * (`variant`, `size`, `loading`, …); `href` plus the anchor props `target`,
 * `rel`, and `download` are forwarded to the i18n `Link`.
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
      render={
        <Link href={href} target={target} rel={rel} download={download} />
      }
      {...props}
    />
  );
};
