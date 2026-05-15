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
        'relative scrollbar-none flex max-w-full snap-x snap-mandatory gap-x-2 overflow-x-scroll',
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
  return (
    <li className={cn('relative shrink-0 snap-start', className)}>
      {children}
    </li>
  );
}
