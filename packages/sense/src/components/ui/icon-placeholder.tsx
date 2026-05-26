// Shim for shadcn's `IconPlaceholder` docs preview component. Maps the
// `lucide` prop (e.g. "XIcon", "ChevronDownIcon") to the matching
// `react-icons/lu` component. Other library hints (tabler, hugeicons,
// phosphor) are ignored — we render the Lucide-equivalent only.

import type { ComponentProps } from 'react';
import * as Lu from 'react-icons/lu';

type Props = {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
  className?: string;
} & Omit<ComponentProps<'svg'>, 'children'>;

export function IconPlaceholder({
  lucide,
  tabler: _t,
  hugeicons: _h,
  phosphor: _p,
  remixicon: _r,
  className,
  ...rest
}: Props) {
  const stripped = lucide.endsWith('Icon') ? lucide.slice(0, -4) : lucide;
  const luName = 'Lu' + stripped;
  const Icon = (
    Lu as unknown as Record<string, React.ComponentType<ComponentProps<'svg'>>>
  )[luName];

  if (!Icon) {
    return <span aria-hidden className={className} />;
  }

  return <Icon aria-hidden className={className} {...rest} />;
}
