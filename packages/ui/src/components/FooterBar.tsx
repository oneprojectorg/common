import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { cn } from '../lib/utils';

const footerBarStyles = tv({
  base: 'z-20 shrink-0 border-t border-neutral-gray1 bg-white backdrop-blur',
  variants: {
    position: {
      sticky: 'sticky bottom-0',
      static: '',
    },
    padding: {
      compact: 'px-8 py-2',
      spacious: 'px-18 py-2',
    },
  },
  defaultVariants: {
    position: 'sticky',
    padding: 'compact',
  },
});

type FooterBarVariants = VariantProps<typeof footerBarStyles>;

interface FooterBarProps extends FooterBarVariants {
  className?: string;
  children: ReactNode;
}

function FooterBar({ className, children, position, padding }: FooterBarProps) {
  return (
    <footer className={footerBarStyles({ position, padding, className })}>
      <div className="flex items-center gap-4">{children}</div>
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
