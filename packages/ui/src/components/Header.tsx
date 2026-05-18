import { headingClasses } from '@op/styles/constants';

import { cn } from '../lib/utils';

export const Header1 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h1 className={cn(headingClasses.h1, className)}>{children}</h1>;
};

export const Header2 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h2 className={cn(headingClasses.h2, className)}>{children}</h2>;
};

export const Header3 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h3 className={cn(headingClasses.h3, className)}>{children}</h3>;
};

export const Header4 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h4
      className={cn('font-serif text-title-sm14 text-neutral-black', className)}
    >
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
    <div className="flex w-full items-center justify-center text-transparent">
      <div
        className={cn(
          'flex items-center bg-clip-text font-serif text-title-xxl',
          gradient,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
