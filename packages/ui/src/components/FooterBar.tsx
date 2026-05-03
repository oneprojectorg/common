import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { cn } from '../lib/utils';

const footerBarStyles = tv({
  base: 'shrink-0 border-t border-neutral-gray1 bg-white backdrop-blur',
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

const footerBarContentStyles = tv({
  base: 'flex items-center gap-4',
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

type FooterBarVariants = VariantProps<typeof footerBarStyles> &
  VariantProps<typeof footerBarContentStyles>;

interface FooterBarProps extends FooterBarVariants {
  className?: string;
  children: ReactNode;
}

function FooterBar({ className, children, position, padding }: FooterBarProps) {
  return (
    <footer className={footerBarStyles({ position, className })}>
      <div className={footerBarContentStyles({ position, padding })}>
        {children}
      </div>
    </footer>
  );
}

function FooterBarStart({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      {children}
    </div>
  );
}

function FooterBarCenter({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center',
        className,
      )}
    >
      {children}
    </div>
  );
}

function FooterBarEnd({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      {children}
    </div>
  );
}

function FooterBarDivider({ className }: { className?: string }) {
  return <div className={cn('h-6 w-px bg-neutral-gray1', className)} />;
}

FooterBar.Start = FooterBarStart;
FooterBar.Center = FooterBarCenter;
FooterBar.End = FooterBarEnd;
FooterBar.Divider = FooterBarDivider;

export {
  FooterBar,
  FooterBarStart,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarDivider,
};
