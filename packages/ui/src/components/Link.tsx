'use client';

import { Link as AriaLink, composeRenderProps } from 'react-aria-components';
import type { LinkProps as AriaLinkProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

interface LinkProps extends AriaLinkProps {
  variant?: 'primary' | 'secondary' | 'neutral';
}

const styles = tv({
  extend: focusRing,
  base: 'rounded transition disabled:cursor-default disabled:no-underline',
  variants: {
    variant: {
      primary: 'text-teal no-underline hover:underline',
      secondary:
        'text-neutral-700 underline decoration-neutral-700/70 hover:decoration-neutral-700',
      neutral: 'text-neutral-gray4',
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
