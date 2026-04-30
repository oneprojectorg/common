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
      primary: 'text-primary no-underline hover:underline',
      secondary:
        'text-muted-foreground underline decoration-muted-foreground/70 hover:decoration-muted-foreground',
      neutral: 'text-muted-foreground',
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
