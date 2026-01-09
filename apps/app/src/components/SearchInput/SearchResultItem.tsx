import { cn } from '@op/ui/utils';

interface SearchResultItemProps {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
}

export const SearchResultItem = ({
  children,
  selected = false,
  className,
}: SearchResultItemProps) => {
  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        'group gap-2 p-4 flex cursor-pointer items-center select-none',
        selected ? 'bg-neutral-offWhite' : 'hover:bg-neutral-offWhite',
        className,
      )}
    >
      {children}
    </div>
  );
};
