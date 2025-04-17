import { cn } from '../lib/utils';

export const Header1 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h1
      className={cn('text-headerMobile sm:text-header font-serif', className)}
    >
      {children}
    </h1>
  );
};

export const Header3 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h3 className={cn('text-base text-black', className)}>{children}</h3>;
};
