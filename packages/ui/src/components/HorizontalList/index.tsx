import { cn } from '../../lib/utils';

export function HorizontalList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid max-w-full snap-x snap-mandatory auto-cols-auto grid-flow-col gap-x-2 overflow-x-scroll scrollbar-none',
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function HorizontalListItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <li className={cn('snap-start', className)}>{children}</li>;
}
