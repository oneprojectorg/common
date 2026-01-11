import { cn } from '../lib/utils';

export const Header1 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h1 className={cn('sm:text-title-lg text-title-sm font-serif', className)}>
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

export const GradientHeader = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className="flex w-full items-center justify-center text-transparent">
      <div
        className={cn(
          'bg-gradient text-title-xxl flex items-center bg-clip-text font-serif',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
