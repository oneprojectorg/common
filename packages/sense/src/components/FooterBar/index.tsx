import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../../lib/utils';
import { Separator } from '../ui/separator';

const footerBarVariants = cva('shrink-0 border-t bg-background backdrop-blur', {
  variants: {
    position: {
      sticky: 'sticky bottom-0 z-20',
      fixed: 'fixed inset-x-0 bottom-0 z-50',
      static: 'z-20',
    },
  },
  defaultVariants: {
    position: 'sticky',
  },
});

const footerBarContentVariants = cva('flex items-center gap-4', {
  variants: {
    padding: {
      compact: 'px-8 py-2',
      spacious: 'px-18 py-2',
    },
    // For fixed mode, center the inner content at the page max-width so
    // Start/End slots align with the content above.
    position: {
      sticky: '',
      fixed: 'mx-auto w-full max-w-6xl',
      static: '',
    },
  },
  defaultVariants: {
    padding: 'compact',
  },
});

interface FooterBarProps
  extends
    React.ComponentProps<'footer'>,
    VariantProps<typeof footerBarVariants>,
    VariantProps<typeof footerBarContentVariants> {}

function FooterBar({
  className,
  children,
  position,
  padding,
  ...props
}: FooterBarProps) {
  return (
    <footer
      data-slot="footer-bar"
      className={cn(footerBarVariants({ position }), className)}
      {...props}
    >
      <div className={footerBarContentVariants({ position, padding })}>
        {children}
      </div>
    </footer>
  );
}

function FooterBarStart({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="footer-bar-start"
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function FooterBarCenter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="footer-bar-center"
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center',
        className,
      )}
      {...props}
    />
  );
}

function FooterBarEnd({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="footer-bar-end"
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function FooterBarDivider({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="footer-bar-divider"
      orientation="vertical"
      className={cn('h-6 self-center', className)}
      {...props}
    />
  );
}

export {
  FooterBar,
  FooterBarStart,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarDivider,
};
