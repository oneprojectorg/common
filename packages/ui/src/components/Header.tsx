import { cn } from '../lib/utils';

export const Header1 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h1 className={cn('font-serif text-title-sm sm:text-title-lg', className)}>
      {children}
    </h1>
  );
};

export const Header2 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h2 className={cn('text-title-lg text-neutral-black', className)}>
      {children}
    </h2>
  );
};

export const Header3 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h3 className={cn('text-title-base text-neutral-black', className)}>
      {children}
    </h3>
  );
};
