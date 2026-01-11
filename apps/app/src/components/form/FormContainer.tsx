import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

export const FormContainer = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('gap-8 pb-8 flex flex-col', className)}>{children}</div>
  );
};
