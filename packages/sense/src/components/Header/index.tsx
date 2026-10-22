import * as React from 'react';

import { cn } from '../../lib/utils';

// Serif headings on the sense semantic type scale (Figma Typography
// collection): display 24→48, headline 20→30, title 18→20, label 16.
//
// Headings carry real content, which on an Arabic page is often English (or the
// reverse), so the text is `<bdi>`-isolated and reads correctly either way. The
// isolation is deliberately on the text and not a `dir` on the heading: a `dir`
// would resolve `text-align: start` against the *content*, left-aligning one
// heading in a column of right-aligned ones. Pass `dir` to override.

interface HeaderProps extends React.ComponentProps<'h1'> {
  dir?: 'ltr' | 'rtl' | 'auto';
}

function Header1({ className, children, ...props }: HeaderProps) {
  return (
    <h1
      className={cn('font-serif text-display font-light', className)}
      {...props}
    >
      <bdi>{children}</bdi>
    </h1>
  );
}

function Header2({ className, children, ...props }: HeaderProps) {
  return (
    <h2
      className={cn('font-serif text-headline font-light', className)}
      {...props}
    >
      <bdi>{children}</bdi>
    </h2>
  );
}

function Header3({ className, children, ...props }: HeaderProps) {
  return (
    <h3 className={cn('font-serif text-title', className)} {...props}>
      <bdi>{children}</bdi>
    </h3>
  );
}

function Header4({ className, children, ...props }: HeaderProps) {
  return (
    <h4 className={cn('font-serif text-label', className)} {...props}>
      <bdi>{children}</bdi>
    </h4>
  );
}

interface GradientHeaderProps extends React.ComponentProps<'div'> {
  /** Background gradient utility class (from @op/styles, e.g. `bg-redTeal`). */
  gradient?: string;
}

function GradientHeader({
  className,
  gradient = 'bg-gradient',
  children,
  ...props
}: GradientHeaderProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-fit items-center bg-clip-text font-serif text-display text-transparent',
        gradient,
        className,
      )}
      {...props}
    >
      <bdi>{children}</bdi>
    </div>
  );
}

export { Header1, Header2, Header3, Header4, GradientHeader };
