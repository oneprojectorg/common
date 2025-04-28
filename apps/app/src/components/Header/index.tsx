import { cn } from '@op/ui/utils';

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

export const Header2 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h3 className={cn('text-lg text-black', className)}>{children}</h3>;
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
