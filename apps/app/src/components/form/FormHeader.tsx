import { Header1 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

export const FormHeader = ({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) => (
  <div className={cn('flex flex-col gap-4', className)}>
    <Header1 className="text-center sm:text-headline">{text}</Header1>

    <p className="px-6 text-center text-darkGray">{children}</p>
  </div>
);
