import * as React from 'react';

import { cn } from '../../lib/utils';

// Serif headings on the sense semantic type scale (Figma Typography
// collection): display 24→48, headline 20→30, title 18→20, label 16.
// `dir="auto"` by default — headings always carry real content, so the
// direction resolves from it.

interface HeaderProps extends React.ComponentProps<'h1'> {
  dir?: 'ltr' | 'rtl' | 'auto';
}

function Header1({ className, dir = 'auto', ...props }: HeaderProps) {
  return (
    <h1
      dir={dir}
      className={cn('font-serif text-display font-light', className)}
      {...props}
    />
  );
}

function Header2({ className, dir = 'auto', ...props }: HeaderProps) {
  return (
    <h2
      dir={dir}
      className={cn('font-serif text-headline font-light', className)}
      {...props}
    />
  );
}

function Header3({ className, dir = 'auto', ...props }: HeaderProps) {
  return (
    <h3
      dir={dir}
      className={cn('font-serif text-title', className)}
      {...props}
    />
  );
}

function Header4({ className, dir = 'auto', ...props }: HeaderProps) {
  return (
    <h4
      dir={dir}
      className={cn('font-serif text-label', className)}
      {...props}
    />
  );
}

interface GradientHeaderProps extends React.ComponentProps<'div'> {
  /** Background gradient utility class (from @op/styles, e.g. `bg-redTeal`). */
  gradient?: string;
}

function GradientHeader({
  className,
  gradient = 'bg-gradient',
  dir = 'auto',
  ...props
}: GradientHeaderProps) {
  return (
    <div
      dir={dir}
      className={cn(
        'mx-auto flex w-fit items-center bg-clip-text font-serif text-display text-transparent',
        gradient,
        className,
      )}
      {...props}
    />
  );
}

export { Header1, Header2, Header3, Header4, GradientHeader };
