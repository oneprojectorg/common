import { Button } from '@op/sense/Button';
import type { ComponentProps } from 'react';

import { Link } from '@/lib/i18n';

type ButtonLinkProps = Omit<ComponentProps<typeof Button>, 'render'> & {
  href: ComponentProps<typeof Link>['href'];
};

/**
 * A sense `Button` that renders as a locale-aware `Link` — the button-styled
 * anchor (replaces `@op/ui`'s `ButtonLink`). Inherits every `Button` prop
 * (`variant`, `size`, `loading`, …); `href` is forwarded to the i18n `Link`.
 */
export const ButtonLink = ({ href, ...props }: ButtonLinkProps) => {
  return <Button render={<Link href={href} />} {...props} />;
};
