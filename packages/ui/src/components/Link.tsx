'use client';

import { Link as AriaLink, composeRenderProps } from 'react-aria-components';
import type { LinkProps as AriaLinkProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

interface LinkProps extends AriaLinkProps {
  variant?: 'primary' | 'secondary';
}

const styles = tv({
  extend: focusRing,
  base: 'rounded underline transition disabled:cursor-default disabled:no-underline',
  variants: {
    variant: {
      primary:
        'text-neutral-500 underline decoration-neutral-500/60 hover:decoration-neutral-500',
      secondary:
        'text-neutral-700 underline decoration-neutral-700/70 hover:decoration-neutral-700',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

export const Link = (props: LinkProps) => {
  return (
    <AriaLink
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className, variant: props.variant }),
      )}
    />
  );
};
