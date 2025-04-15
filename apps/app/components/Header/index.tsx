import { cn } from '@op/ui/utils';

export const Header = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <header
      className={cn('text-headerMobile sm:text-header font-serif', className)}
    >
      {children}
    </header>
  );
};
