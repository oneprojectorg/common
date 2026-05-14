import { cn } from '../lib/utils';

export function Header1({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={cn('font-serif text-title-sm sm:text-title-lg', className)}>
      {children}
    </h1>
  );
}

export function Header2({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('text-foreground text-title-lg', className)}>
      {children}
    </h2>
  );
}

export function Header3({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('text-foreground text-title-base', className)}>
      {children}
    </h3>
  );
}

export function Header4({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4 className={cn('text-foreground font-serif text-title-sm14', className)}>
      {children}
    </h4>
  );
}

export function GradientHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex w-full items-center justify-center text-transparent">
      <div
        className={cn(
          'flex items-center bg-gradient bg-clip-text font-serif text-title-xxl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
