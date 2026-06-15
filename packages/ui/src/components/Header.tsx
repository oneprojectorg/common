import { headingClasses } from '@op/styles/constants';

import { cn } from '../lib/utils';

export const Header1 = ({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) => {
  return (
    <h1 dir={dir} className={cn(headingClasses.h1, className)}>
      {children}
    </h1>
  );
};

export const Header2 = ({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) => {
  return (
    <h2 dir={dir} className={cn(headingClasses.h2, className)}>
      {children}
    </h2>
  );
};

export const Header3 = ({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) => {
  return (
    <h3 dir={dir} className={cn(headingClasses.h3, className)}>
      {children}
    </h3>
  );
};

export const Header4 = ({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) => {
  return (
    <h4 dir={dir} className={cn(headingClasses.h4, className)}>
      {children}
    </h4>
  );
};

export const GradientHeader = ({
  children,
  className,
  gradient = 'bg-gradient',
}: {
  children?: React.ReactNode;
  className?: string;
  /** Background gradient utility class (e.g. `bg-coralCoral`). Defaults to the teal/green `bg-gradient`. */
  gradient?: string;
}) => {
  return (
    <div
      className={cn(
        'mx-auto flex w-fit items-center bg-clip-text font-serif text-title-xxl text-transparent',
        gradient,
        className,
      )}
    >
      {children}
    </div>
  );
};
