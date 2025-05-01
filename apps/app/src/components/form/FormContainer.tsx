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
    <div className={cn('flex flex-col gap-8 pb-8', className)}>{children}</div>
  );
};
